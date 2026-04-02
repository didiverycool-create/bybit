from __future__ import annotations

import json
import subprocess
import time
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional

from models import OpenClawStatus


class OpenClawGatewayClient:
    def __init__(self, config_path: Optional[Path] = None) -> None:
        self.config_path = config_path or Path.home() / ".openclaw" / "openclaw.json"

    def _load_config(self) -> Dict:
        if not self.config_path.exists():
            return {}
        try:
            return json.loads(self.config_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            return {}

    def _run(self, args: List[str]) -> Optional[str]:
        try:
            completed = subprocess.run(
                args,
                capture_output=True,
                text=True,
                timeout=5,
                check=False,
            )
            output = (completed.stdout or completed.stderr).strip()
            return output or None
        except (FileNotFoundError, subprocess.TimeoutExpired):
            return None

    def _run_json(self, args: List[str], timeout: int = 30) -> Optional[Dict[str, Any]]:
        try:
            completed = subprocess.run(
                args,
                capture_output=True,
                text=True,
                timeout=timeout,
                check=False,
            )
        except (FileNotFoundError, subprocess.TimeoutExpired):
            return None

        stdout = (completed.stdout or "").strip()
        stderr = (completed.stderr or "").strip()
        payload: Dict[str, Any] = {
            "ok": completed.returncode == 0,
            "returncode": completed.returncode,
            "stdout": stdout,
            "stderr": stderr,
        }
        if stdout:
            try:
                payload["json"] = json.loads(stdout)
            except json.JSONDecodeError:
                payload["json"] = None
        else:
            payload["json"] = None
        return payload

    @staticmethod
    def _parse_agent_response(
        response: Optional[Dict[str, Any]],
        resolved_agent: Optional[str],
    ) -> Dict[str, Any]:
        if not resolved_agent:
            return {
                "ok": False,
                "agent_id": None,
                "text": None,
                "error": "未找到可用的 OpenClaw agent。",
            }

        if not response:
            return {
                "ok": False,
                "agent_id": resolved_agent,
                "text": None,
                "error": "调用 OpenClaw agent 超时或失败。",
            }

        payload = response.get("json")
        if not response.get("ok") or not isinstance(payload, dict):
            return {
                "ok": False,
                "agent_id": resolved_agent,
                "text": None,
                "error": response.get("stderr") or response.get("stdout") or "OpenClaw agent 返回失败。",
            }

        result = payload.get("result", {})
        payloads = result.get("payloads", []) if isinstance(result, dict) else []
        text = None
        for item in payloads:
            if isinstance(item, dict) and item.get("text"):
                text = item["text"]
                break

        return {
            "ok": True,
            "agent_id": resolved_agent,
            "text": text,
            "raw": payload,
        }

    def list_agents(self) -> List[Dict[str, Any]]:
        response = self._run_json(["openclaw", "agents", "list", "--json"], timeout=10)
        if not response or not isinstance(response.get("json"), list):
            return []
        return response["json"]

    def resolve_agent_id(self) -> Optional[str]:
        config = self._load_config()
        configured_default = config.get("acp", {}).get("defaultAgent")
        agents = self.list_agents()
        if not agents:
            return configured_default

        ids = {str(item.get("id")) for item in agents if item.get("id")}
        if configured_default in ids:
            return configured_default

        default_agent = next((item for item in agents if item.get("isDefault")), None)
        if default_agent and default_agent.get("id"):
            return str(default_agent["id"])

        first_agent = next((item for item in agents if item.get("id")), None)
        return str(first_agent["id"]) if first_agent else configured_default

    def run_agent_turn(
        self,
        message: str,
        timeout: int = 120,
        agent_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        resolved_agent = agent_id or self.resolve_agent_id()
        response = self._run_json(
            [
                "openclaw",
                "agent",
                "--agent",
                resolved_agent,
                "--message",
                message,
                "--json",
                "--timeout",
                str(timeout),
            ],
            timeout=max(timeout + 15, 30),
        )
        return self._parse_agent_response(response, resolved_agent)

    def run_agent_turn_cancelable(
        self,
        message: str,
        timeout: int = 120,
        agent_id: Optional[str] = None,
        should_cancel: Optional[Callable[[], bool]] = None,
    ) -> Dict[str, Any]:
        resolved_agent = agent_id or self.resolve_agent_id()
        if not resolved_agent:
            return {
                "ok": False,
                "agent_id": None,
                "text": None,
                "error": "未找到可用的 OpenClaw agent。",
            }

        try:
            process = subprocess.Popen(
                [
                    "openclaw",
                    "agent",
                    "--agent",
                    resolved_agent,
                    "--message",
                    message,
                    "--json",
                    "--timeout",
                    str(timeout),
                ],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
            )
        except FileNotFoundError:
            return {
                "ok": False,
                "agent_id": resolved_agent,
                "text": None,
                "error": "未找到 openclaw 命令。",
            }

        started_at = time.monotonic()
        while True:
            if should_cancel and should_cancel():
                process.terminate()
                try:
                    process.wait(timeout=2)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait(timeout=2)
                stdout, stderr = process.communicate()
                return {
                    "ok": False,
                    "agent_id": resolved_agent,
                    "text": None,
                    "error": "任务已由控制端终止。",
                    "cancelled": True,
                    "stdout": (stdout or "").strip(),
                    "stderr": (stderr or "").strip(),
                }

            if time.monotonic() - started_at > max(timeout + 15, 30):
                process.terminate()
                try:
                    process.wait(timeout=2)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait(timeout=2)
                stdout, stderr = process.communicate()
                return {
                    "ok": False,
                    "agent_id": resolved_agent,
                    "text": None,
                    "error": "调用 OpenClaw agent 超时。",
                    "stdout": (stdout or "").strip(),
                    "stderr": (stderr or "").strip(),
                }

            returncode = process.poll()
            if returncode is not None:
                stdout, stderr = process.communicate()
                response: Dict[str, Any] = {
                    "ok": returncode == 0,
                    "returncode": returncode,
                    "stdout": (stdout or "").strip(),
                    "stderr": (stderr or "").strip(),
                }
                if response["stdout"]:
                    try:
                        response["json"] = json.loads(response["stdout"])
                    except json.JSONDecodeError:
                        response["json"] = None
                else:
                    response["json"] = None
                return self._parse_agent_response(response, resolved_agent)

            time.sleep(0.2)

    def get_status(self, worker_state: Optional[Dict[str, Any]] = None) -> OpenClawStatus:
        config = self._load_config()
        gateway = config.get("gateway", {})
        agents = config.get("acp", {})
        heartbeat_cfg = config.get("agents", {}).get("defaults", {}).get("heartbeat", {})

        health_output = self._run(["openclaw", "health"])
        status_output = self._run(["openclaw", "gateway", "status"])
        gateway_url = gateway.get("remote", {}).get("url") or "ws://127.0.0.1:18789"

        return OpenClawStatus(
            configured=bool(config),
            gateway_url=gateway_url,
            auth_mode=gateway.get("auth", {}).get("mode"),
            default_agent=agents.get("defaultAgent"),
            resolved_agent=self.resolve_agent_id(),
            heartbeat=heartbeat_cfg.get("every"),
            health_output=health_output,
            status_output=status_output,
            reachable=bool(status_output and "RPC probe: ok" in status_output),
            worker_running=bool(worker_state.get("running")) if worker_state else False,
            active_job_id=worker_state.get("active_job_id") if worker_state else None,
            last_worker_event_at=worker_state.get("last_worker_event_at") if worker_state else None,
            last_job_id=worker_state.get("last_job_id") if worker_state else None,
            last_job_status=worker_state.get("last_job_status") if worker_state else None,
            last_job_summary=worker_state.get("last_job_summary") if worker_state else None,
        )
