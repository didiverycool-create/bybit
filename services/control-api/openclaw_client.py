from __future__ import annotations

import json
import subprocess
from pathlib import Path
from typing import Dict, List, Optional

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

    def get_status(self) -> OpenClawStatus:
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
            heartbeat=heartbeat_cfg.get("every"),
            health_output=health_output,
            status_output=status_output,
            reachable=bool(status_output and "RPC probe: ok" in status_output),
        )
