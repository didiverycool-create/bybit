from __future__ import annotations

import json
import shutil
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

    @staticmethod
    def _extract_first_json_object(text: str) -> Optional[Dict[str, Any]]:
        if not text:
            return None
        stripped = text.strip()
        if not stripped:
            return None
        candidates: List[str] = [stripped]
        if "```" in stripped:
            for part in stripped.split("```"):
                candidate = part.strip()
                if candidate.lower().startswith("json"):
                    candidate = candidate[4:].strip()
                if candidate.startswith("{") and candidate.endswith("}"):
                    candidates.append(candidate)
        for candidate in candidates:
            if not candidate.startswith("{"):
                start = candidate.find("{")
                end = candidate.rfind("}")
                if start == -1 or end == -1 or end <= start:
                    continue
                candidate = candidate[start : end + 1]
            try:
                parsed = json.loads(candidate)
            except json.JSONDecodeError:
                continue
            if isinstance(parsed, dict):
                return parsed
        return None

    @staticmethod
    def _coerce_bool_flag(value: Any) -> Optional[bool]:
        if isinstance(value, bool):
            return value
        if value is None:
            return None
        if isinstance(value, (int, float)):
            return bool(value)
        if isinstance(value, str):
            token = value.strip().lower()
            if token in {"true", "yes", "y", "1", "需要", "是", "待人工", "manual", "needed"}:
                return True
            if token in {"false", "no", "n", "0", "不需要", "否", "auto", "clean"}:
                return False
        return None

    @staticmethod
    def _coerce_string_list(value: Any, limit: int = 6) -> List[str]:
        out: List[str] = []
        if isinstance(value, list):
            items = value
        elif isinstance(value, str):
            items = [segment for segment in value.replace("；", ";").split(";")]
        else:
            items = []
        for item in items:
            text = str(item).strip()
            if text:
                out.append(text)
            if len(out) >= limit:
                break
        return out

    @classmethod
    def parse_reconcile_change_request_response(cls, text: Optional[str]) -> Dict[str, Any]:
        """Parse the structured response for a ``reconcile_change_request`` agent job.

        Accepts either a JSON object of the form
        ``{"summary", "landed", "needs_manual_review", "needs_manual_review_detail",
        "next_actions"}`` or a plain-text summary fallback.

        The returned dict always contains ``summary``, ``landed``,
        ``needs_manual_review``, ``needs_manual_review_detail``, ``next_actions``
        and ``raw_text`` keys so that downstream call sites never have to branch
        on whether OpenClaw actually produced a JSON payload.
        """

        raw_text = (text or "").strip()
        parsed = cls._extract_first_json_object(raw_text)
        summary: str
        landed: Optional[bool]
        needs_manual: Optional[bool]
        manual_detail: Optional[str]
        next_actions: List[str]
        if isinstance(parsed, dict):
            summary = str(parsed.get("summary") or "").strip()
            landed = cls._coerce_bool_flag(parsed.get("landed"))
            needs_manual = cls._coerce_bool_flag(
                parsed.get("needs_manual_review")
                if parsed.get("needs_manual_review") is not None
                else parsed.get("manual_followup_required")
            )
            manual_detail_raw = parsed.get("needs_manual_review_detail") or parsed.get("manual_followup_detail")
            manual_detail = str(manual_detail_raw).strip() if manual_detail_raw else None
            next_actions = cls._coerce_string_list(parsed.get("next_actions"))
        else:
            summary = raw_text
            landed = None
            needs_manual = None
            manual_detail = None
            next_actions = []

        if not summary:
            summary = "OpenClaw 已返回变更请求跟进结果。"

        # Infer a sensible manual detail if the prompt only flagged ``needs_manual_review``.
        if needs_manual and not manual_detail:
            manual_detail = summary[:160]

        return {
            "summary": summary,
            "landed": landed,
            "needs_manual_review": bool(needs_manual) if needs_manual is not None else None,
            "needs_manual_review_detail": manual_detail,
            "next_actions": next_actions,
            "raw_text": raw_text,
        }

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
            config_path=str(self.config_path),
            config_exists=self.config_path.exists(),
            command_available=shutil.which("openclaw") is not None,
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
