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

    # Canonical strategy-tracking review statuses. Keep in sync with the prompt
    # text in ``main.build_agent_job_prompt`` so OpenClaw only has to emit one
    # of these three vocab terms (with common Chinese aliases).
    _STRATEGY_TRACKING_STATUS_ALIASES: Dict[str, str] = {
        "on_track": "on_track",
        "ontrack": "on_track",
        "healthy": "on_track",
        "ok": "on_track",
        "fine": "on_track",
        "稳定": "on_track",
        "正常": "on_track",
        "良好": "on_track",
        "无需跟进": "on_track",
        "needs_attention": "needs_attention",
        "attention": "needs_attention",
        "watch": "needs_attention",
        "monitor": "needs_attention",
        "warning": "needs_attention",
        "关注": "needs_attention",
        "观察": "needs_attention",
        "需关注": "needs_attention",
        "escalate": "escalate",
        "critical": "escalate",
        "manual": "escalate",
        "urgent": "escalate",
        "升级": "escalate",
        "人工": "escalate",
        "高危": "escalate",
        "紧急": "escalate",
    }

    @classmethod
    def _coerce_strategy_tracking_status(cls, value: Any) -> Optional[str]:
        if value is None:
            return None
        if isinstance(value, bool):
            return None
        if isinstance(value, (int, float)):
            return None
        token = str(value).strip().lower()
        if not token:
            return None
        if token in cls._STRATEGY_TRACKING_STATUS_ALIASES:
            return cls._STRATEGY_TRACKING_STATUS_ALIASES[token]
        for alias, canonical in cls._STRATEGY_TRACKING_STATUS_ALIASES.items():
            if alias in token:
                return canonical
        return None

    @classmethod
    def parse_strategy_tracking_review_response(cls, text: Optional[str]) -> Dict[str, Any]:
        """Parse the structured response for ``review_strategy_change`` / ``review_strategy_issue``.

        Accepts either a JSON object of the form
        ``{"summary", "status", "findings", "next_actions", "highlights", "risks"}``
        (status being one of ``on_track`` / ``needs_attention`` / ``escalate``)
        or a plain-text fallback. Aliases such as ``"稳定"``, ``"watch"``,
        ``"升级"`` are normalized to the canonical status vocabulary; any
        unrecognized value degrades to ``None`` so callers can decide whether
        to substitute a default.

        The returned dict always contains ``summary``, ``status``, ``findings``,
        ``next_actions``, ``highlights``, ``risks`` and ``raw_text`` so call
        sites never have to branch on whether OpenClaw produced JSON — keeping
        the worker loop simple and letting us add richer downstream rendering
        without touching the parser again.
        """

        raw_text = (text or "").strip()
        parsed = cls._extract_first_json_object(raw_text)
        summary: str
        status: Optional[str]
        findings: List[str]
        next_actions: List[str]
        highlights: List[str]
        risks: List[str]
        if isinstance(parsed, dict):
            summary = str(parsed.get("summary") or "").strip()
            status = cls._coerce_strategy_tracking_status(parsed.get("status"))
            findings = cls._coerce_string_list(parsed.get("findings"))
            next_actions = cls._coerce_string_list(parsed.get("next_actions"))
            highlights = cls._coerce_string_list(parsed.get("highlights"))
            risks = cls._coerce_string_list(parsed.get("risks"))
            # ``findings`` is the new canonical slot, but keep backwards
            # compatibility with older prompts that only emitted highlights —
            # when the agent returns highlights/risks and omits findings, we
            # synthesize findings from them so downstream renderers always get
            # a non-empty list if anything at all was reported.
            if not findings:
                synthesized: List[str] = []
                for item in highlights:
                    synthesized.append(item)
                    if len(synthesized) >= 6:
                        break
                for item in risks:
                    if len(synthesized) >= 6:
                        break
                    synthesized.append(item)
                findings = synthesized
        else:
            summary = raw_text
            status = None
            findings = []
            next_actions = []
            highlights = []
            risks = []

        if not summary:
            summary = "OpenClaw 已返回策略跟踪结果。"

        return {
            "summary": summary,
            "status": status,
            "findings": findings,
            "next_actions": next_actions,
            "highlights": highlights,
            "risks": risks,
            "raw_text": raw_text,
        }

    # ------------------------------------------------------------------
    # Strategy change review (``review_strategy_change``)
    # ------------------------------------------------------------------
    # Canonical verdict vocabulary for LLM reviews of strategy change
    # proposals. The prompt asks OpenClaw to emit one of ``approve`` /
    # ``request_changes`` / ``reject`` but in practice the agent may echo
    # Chinese synonyms or slight English variants, so we normalize those
    # into the canonical tokens here. Unknown values degrade to
    # ``"request_changes"`` (the conservative default) via
    # ``_coerce_strategy_change_verdict``.
    _STRATEGY_CHANGE_VERDICT_ALIASES: Dict[str, str] = {
        "approve": "approve",
        "approved": "approve",
        "lgtm": "approve",
        "ship": "approve",
        "通过": "approve",
        "同意": "approve",
        "批准": "approve",
        "request_changes": "request_changes",
        "requests_changes": "request_changes",
        "changes_requested": "request_changes",
        "needs_changes": "request_changes",
        "needs-changes": "request_changes",
        "needs changes": "request_changes",
        "调整": "request_changes",
        "待调整": "request_changes",
        "需调整": "request_changes",
        "修改": "request_changes",
        "reject": "reject",
        "rejected": "reject",
        "block": "reject",
        "blocked": "reject",
        "拒绝": "reject",
        "否决": "reject",
        "驳回": "reject",
    }

    # Confidence levels for strategy change reviews. Same pattern as the
    # verdict alias map — we accept a handful of Chinese/English synonyms
    # and normalize them, falling back to ``"medium"`` when we can't map
    # the value.
    _STRATEGY_CHANGE_CONFIDENCE_ALIASES: Dict[str, str] = {
        "low": "low",
        "lo": "low",
        "weak": "low",
        "低": "low",
        "弱": "low",
        "medium": "medium",
        "mid": "medium",
        "moderate": "medium",
        "normal": "medium",
        "中": "medium",
        "一般": "medium",
        "high": "high",
        "hi": "high",
        "strong": "high",
        "高": "high",
        "强": "high",
    }

    @classmethod
    def _coerce_strategy_change_verdict(cls, value: Any) -> Optional[str]:
        if value is None:
            return None
        if isinstance(value, bool):
            return None
        if isinstance(value, (int, float)):
            return None
        token = str(value).strip().lower()
        if not token:
            return None
        if token in cls._STRATEGY_CHANGE_VERDICT_ALIASES:
            return cls._STRATEGY_CHANGE_VERDICT_ALIASES[token]
        for alias, canonical in cls._STRATEGY_CHANGE_VERDICT_ALIASES.items():
            if alias in token:
                return canonical
        return None

    @classmethod
    def _coerce_strategy_change_confidence(cls, value: Any) -> Optional[str]:
        if value is None:
            return None
        if isinstance(value, bool):
            return None
        if isinstance(value, (int, float)):
            return None
        token = str(value).strip().lower()
        if not token:
            return None
        if token in cls._STRATEGY_CHANGE_CONFIDENCE_ALIASES:
            return cls._STRATEGY_CHANGE_CONFIDENCE_ALIASES[token]
        for alias, canonical in cls._STRATEGY_CHANGE_CONFIDENCE_ALIASES.items():
            if alias in token:
                return canonical
        return None

    @staticmethod
    def _coerce_newline_string_list(value: Any, limit: int = 8) -> List[str]:
        """Accept either a list of strings or a newline-separated string.

        This is the list coercer used by the change/issue review parsers —
        prompts sometimes emit bullet-style lists as a single string with
        ``\\n`` separators, so we split on newlines and drop empty pieces.
        Semicolon-separated strings are also accepted so callers stay
        compatible with ``_coerce_string_list``.
        """

        out: List[str] = []
        if isinstance(value, list):
            items = value
        elif isinstance(value, str):
            normalized = value.replace("\r\n", "\n").replace("\r", "\n").replace("；", ";")
            chunks: List[str] = []
            for line in normalized.split("\n"):
                for piece in line.split(";"):
                    chunks.append(piece)
            items = chunks
        else:
            items = []
        for item in items:
            text = str(item).strip()
            # Drop leading bullet markers so ``"- item"`` becomes ``"item"``.
            for marker in ("- ", "* ", "• "):
                if text.startswith(marker):
                    text = text[len(marker) :].strip()
                    break
            if text:
                out.append(text)
            if len(out) >= limit:
                break
        return out

    @classmethod
    def parse_strategy_change_review_response(cls, text: Optional[str]) -> Dict[str, Any]:
        """Parse the structured response for a ``review_strategy_change`` agent job.

        Accepts either a JSON object of the form
        ``{"summary", "verdict", "confidence", "highlights", "risks",
        "required_adjustments"}`` or a plain-text fallback. The verdict is
        normalized to one of ``approve`` / ``request_changes`` / ``reject``
        and confidence to one of ``low`` / ``medium`` / ``high``; unknown
        values degrade to ``"request_changes"`` / ``"medium"`` so callers
        always receive a defined verdict/confidence pair without having to
        special-case missing fields.

        The returned dict always contains ``summary``, ``verdict``,
        ``confidence``, ``highlights``, ``risks``, ``required_adjustments``
        and ``raw_text`` keys so the worker loop never has to branch on
        whether OpenClaw produced JSON.
        """

        raw_text = text if isinstance(text, str) else ""
        stripped = raw_text.strip()
        if not stripped:
            return {
                "summary": "",
                "verdict": "request_changes",
                "confidence": "medium",
                "highlights": [],
                "risks": [],
                "required_adjustments": [],
                "raw_text": raw_text,
            }

        parsed = cls._extract_first_json_object(stripped)
        summary: str
        verdict: Optional[str]
        confidence: Optional[str]
        highlights: List[str]
        risks: List[str]
        required_adjustments: List[str]
        if isinstance(parsed, dict):
            summary = str(parsed.get("summary") or "").strip()
            verdict = cls._coerce_strategy_change_verdict(
                parsed.get("verdict")
                if parsed.get("verdict") is not None
                else parsed.get("decision")
            )
            confidence = cls._coerce_strategy_change_confidence(parsed.get("confidence"))
            highlights = cls._coerce_newline_string_list(parsed.get("highlights"))
            risks = cls._coerce_newline_string_list(parsed.get("risks"))
            required_adjustments = cls._coerce_newline_string_list(
                parsed.get("required_adjustments")
                if parsed.get("required_adjustments") is not None
                else parsed.get("adjustments")
            )
        else:
            summary = stripped
            verdict = None
            confidence = None
            highlights = []
            risks = []
            required_adjustments = []

        if not summary:
            summary = "OpenClaw 已返回策略变更评审结果。"

        return {
            "summary": summary,
            "verdict": verdict or "request_changes",
            "confidence": confidence or "medium",
            "highlights": highlights,
            "risks": risks,
            "required_adjustments": required_adjustments,
            "raw_text": raw_text,
        }

    # ------------------------------------------------------------------
    # Strategy issue review (``review_strategy_issue``)
    # ------------------------------------------------------------------
    # Severity vocabulary for ongoing-issue triage reviews. Canonical
    # tokens: ``info`` / ``warning`` / ``critical``. Unknown values degrade
    # to ``"warning"`` via ``parse_strategy_issue_review_response`` —
    # that's the conservative middle ground so we never silently hide a
    # problem or over-escalate a routine observation.
    _STRATEGY_ISSUE_SEVERITY_ALIASES: Dict[str, str] = {
        "info": "info",
        "informational": "info",
        "normal": "info",
        "ok": "info",
        "low": "info",
        "信息": "info",
        "正常": "info",
        "提示": "info",
        "warning": "warning",
        "warn": "warning",
        "medium": "warning",
        "moderate": "warning",
        "attention": "warning",
        "警告": "warning",
        "注意": "warning",
        "关注": "warning",
        "critical": "critical",
        "crit": "critical",
        "blocker": "critical",
        "escalate": "critical",
        "severe": "critical",
        "high": "critical",
        "严重": "critical",
        "高危": "critical",
        "紧急": "critical",
        "升级": "critical",
    }

    @classmethod
    def _coerce_strategy_issue_severity(cls, value: Any) -> Optional[str]:
        if value is None:
            return None
        if isinstance(value, bool):
            return None
        if isinstance(value, (int, float)):
            return None
        token = str(value).strip().lower()
        if not token:
            return None
        if token in cls._STRATEGY_ISSUE_SEVERITY_ALIASES:
            return cls._STRATEGY_ISSUE_SEVERITY_ALIASES[token]
        for alias, canonical in cls._STRATEGY_ISSUE_SEVERITY_ALIASES.items():
            if alias in token:
                return canonical
        return None

    @classmethod
    def parse_strategy_issue_review_response(cls, text: Optional[str]) -> Dict[str, Any]:
        """Parse the structured response for a ``review_strategy_issue`` agent job.

        Accepts either a JSON object of the form
        ``{"summary", "severity", "root_causes", "mitigations", "follow_ups"}``
        or a plain-text fallback. Severity is normalized to one of
        ``info`` / ``warning`` / ``critical`` — unknown values degrade to
        ``"warning"`` so callers always receive a defined severity tier
        without having to substitute a default themselves.

        The returned dict always contains ``summary``, ``severity``,
        ``root_causes``, ``mitigations``, ``follow_ups`` and ``raw_text``
        so the worker loop never has to branch on whether OpenClaw
        produced JSON.
        """

        raw_text = text if isinstance(text, str) else ""
        stripped = raw_text.strip()
        if not stripped:
            return {
                "summary": "",
                "severity": "warning",
                "root_causes": [],
                "mitigations": [],
                "follow_ups": [],
                "raw_text": raw_text,
            }

        parsed = cls._extract_first_json_object(stripped)
        summary: str
        severity: Optional[str]
        root_causes: List[str]
        mitigations: List[str]
        follow_ups: List[str]
        if isinstance(parsed, dict):
            summary = str(parsed.get("summary") or "").strip()
            severity = cls._coerce_strategy_issue_severity(parsed.get("severity"))
            root_causes = cls._coerce_newline_string_list(
                parsed.get("root_causes")
                if parsed.get("root_causes") is not None
                else parsed.get("causes")
            )
            mitigations = cls._coerce_newline_string_list(
                parsed.get("mitigations")
                if parsed.get("mitigations") is not None
                else parsed.get("actions")
            )
            follow_ups = cls._coerce_newline_string_list(
                parsed.get("follow_ups")
                if parsed.get("follow_ups") is not None
                else parsed.get("followups")
            )
        else:
            summary = stripped
            severity = None
            root_causes = []
            mitigations = []
            follow_ups = []

        if not summary:
            summary = "OpenClaw 已返回策略问题评审结果。"

        return {
            "summary": summary,
            "severity": severity or "warning",
            "root_causes": root_causes,
            "mitigations": mitigations,
            "follow_ups": follow_ups,
            "raw_text": raw_text,
        }

    # ------------------------------------------------------------------
    # Daily review (``generate_daily_review``)
    # ------------------------------------------------------------------
    # Canonical sentiment vocabulary for the daily operations review.
    # Prompt emits one of ``bullish`` / ``neutral`` / ``bearish`` but the
    # agent may echo Chinese synonyms or adjacent English terms; we
    # normalize those here. Unknown values degrade to ``"neutral"`` via
    # ``parse_daily_review_response`` — the conservative middle ground
    # matches the pattern used by the strategy-change and issue parsers.
    _DAILY_REVIEW_SENTIMENT_ALIASES: Dict[str, str] = {
        "bullish": "bullish",
        "positive": "bullish",
        "up": "bullish",
        "看多": "bullish",
        "积极": "bullish",
        "neutral": "neutral",
        "normal": "neutral",
        "flat": "neutral",
        "中性": "neutral",
        "bearish": "bearish",
        "negative": "bearish",
        "down": "bearish",
        "看空": "bearish",
        "消极": "bearish",
    }

    @classmethod
    def _coerce_daily_review_sentiment(cls, value: Any) -> Optional[str]:
        if value is None:
            return None
        if isinstance(value, bool):
            return None
        if isinstance(value, (int, float)):
            return None
        token = str(value).strip().lower()
        if not token:
            return None
        if token in cls._DAILY_REVIEW_SENTIMENT_ALIASES:
            return cls._DAILY_REVIEW_SENTIMENT_ALIASES[token]
        for alias, canonical in cls._DAILY_REVIEW_SENTIMENT_ALIASES.items():
            if alias in token:
                return canonical
        return None

    @classmethod
    def parse_daily_review_response(cls, text: Optional[str]) -> Dict[str, Any]:
        """Parse the structured response for a ``generate_daily_review`` agent job.

        Accepts either a JSON object of the form
        ``{"summary", "sentiment", "key_wins", "key_losses",
        "market_observations", "next_day_priorities"}`` or a plain-text
        fallback. Sentiment is normalized to one of ``bullish`` /
        ``neutral`` / ``bearish``; unknown values degrade to
        ``"neutral"`` so downstream renderers never have to substitute a
        default themselves.

        The returned dict always contains ``summary``, ``sentiment``,
        ``key_wins``, ``key_losses``, ``market_observations``,
        ``next_day_priorities`` and ``raw_text`` so the worker loop never
        has to branch on whether OpenClaw produced JSON.
        """

        raw_text = text if isinstance(text, str) else ""
        stripped = raw_text.strip()
        if not stripped:
            return {
                "summary": "",
                "sentiment": "neutral",
                "key_wins": [],
                "key_losses": [],
                "market_observations": [],
                "next_day_priorities": [],
                "raw_text": raw_text,
            }

        parsed = cls._extract_first_json_object(stripped)
        summary: str
        sentiment: Optional[str]
        key_wins: List[str]
        key_losses: List[str]
        market_observations: List[str]
        next_day_priorities: List[str]
        if isinstance(parsed, dict):
            summary = str(parsed.get("summary") or "").strip()
            sentiment = cls._coerce_daily_review_sentiment(parsed.get("sentiment"))
            key_wins = cls._coerce_newline_string_list(
                parsed.get("key_wins")
                if parsed.get("key_wins") is not None
                else parsed.get("wins")
            )
            key_losses = cls._coerce_newline_string_list(
                parsed.get("key_losses")
                if parsed.get("key_losses") is not None
                else parsed.get("losses")
            )
            market_observations = cls._coerce_newline_string_list(
                parsed.get("market_observations")
                if parsed.get("market_observations") is not None
                else parsed.get("observations")
            )
            next_day_priorities = cls._coerce_newline_string_list(
                parsed.get("next_day_priorities")
                if parsed.get("next_day_priorities") is not None
                else parsed.get("priorities")
            )
        else:
            summary = stripped
            sentiment = None
            key_wins = []
            key_losses = []
            market_observations = []
            next_day_priorities = []

        if not summary:
            summary = "OpenClaw 已返回每日策略运行复盘。"

        return {
            "summary": summary,
            "sentiment": sentiment or "neutral",
            "key_wins": key_wins,
            "key_losses": key_losses,
            "market_observations": market_observations,
            "next_day_priorities": next_day_priorities,
            "raw_text": raw_text,
        }

    # ------------------------------------------------------------------
    # Backtest review (``generate_backtest_review``)
    # ------------------------------------------------------------------
    # Canonical overall-rating vocabulary for the backtest review job.
    # Prompt emits one of ``strong`` / ``acceptable`` / ``weak`` but the
    # agent may echo Chinese synonyms or adjacent English terms. Unknown
    # values degrade to ``"acceptable"`` via
    # ``parse_backtest_review_response`` — the conservative middle ground
    # so we neither over-promote nor over-flag a backtest on ambiguous
    # wording.
    _BACKTEST_REVIEW_RATING_ALIASES: Dict[str, str] = {
        "strong": "strong",
        "excellent": "strong",
        "good": "strong",
        "优秀": "strong",
        "推荐": "strong",
        "acceptable": "acceptable",
        "okay": "acceptable",
        "ok": "acceptable",
        "fair": "acceptable",
        "合格": "acceptable",
        "可用": "acceptable",
        "weak": "weak",
        "poor": "weak",
        "bad": "weak",
        "偏弱": "weak",
        "不推荐": "weak",
        "不合格": "weak",
    }

    @classmethod
    def _coerce_backtest_review_rating(cls, value: Any) -> Optional[str]:
        if value is None:
            return None
        if isinstance(value, bool):
            return None
        if isinstance(value, (int, float)):
            return None
        token = str(value).strip().lower()
        if not token:
            return None
        if token in cls._BACKTEST_REVIEW_RATING_ALIASES:
            return cls._BACKTEST_REVIEW_RATING_ALIASES[token]
        for alias, canonical in cls._BACKTEST_REVIEW_RATING_ALIASES.items():
            if alias in token:
                return canonical
        return None

    @classmethod
    def parse_backtest_review_response(cls, text: Optional[str]) -> Dict[str, Any]:
        """Parse the structured response for a ``generate_backtest_review`` agent job.

        Accepts either a JSON object of the form
        ``{"summary", "overall_rating", "strengths", "weaknesses",
        "risk_flags", "recommended_actions"}`` or a plain-text fallback.
        ``overall_rating`` is normalized to one of ``strong`` /
        ``acceptable`` / ``weak``; unknown values degrade to
        ``"acceptable"`` so callers always receive a defined rating
        without having to substitute a default themselves.

        The returned dict always contains ``summary``, ``overall_rating``,
        ``strengths``, ``weaknesses``, ``risk_flags``,
        ``recommended_actions`` and ``raw_text`` so the worker loop never
        has to branch on whether OpenClaw produced JSON.
        """

        raw_text = text if isinstance(text, str) else ""
        stripped = raw_text.strip()
        if not stripped:
            return {
                "summary": "",
                "overall_rating": "acceptable",
                "strengths": [],
                "weaknesses": [],
                "risk_flags": [],
                "recommended_actions": [],
                "raw_text": raw_text,
            }

        parsed = cls._extract_first_json_object(stripped)
        summary: str
        overall_rating: Optional[str]
        strengths: List[str]
        weaknesses: List[str]
        risk_flags: List[str]
        recommended_actions: List[str]
        if isinstance(parsed, dict):
            summary = str(parsed.get("summary") or "").strip()
            overall_rating = cls._coerce_backtest_review_rating(
                parsed.get("overall_rating")
                if parsed.get("overall_rating") is not None
                else parsed.get("rating")
            )
            strengths = cls._coerce_newline_string_list(parsed.get("strengths"))
            weaknesses = cls._coerce_newline_string_list(parsed.get("weaknesses"))
            risk_flags = cls._coerce_newline_string_list(
                parsed.get("risk_flags")
                if parsed.get("risk_flags") is not None
                else parsed.get("risks")
            )
            recommended_actions = cls._coerce_newline_string_list(
                parsed.get("recommended_actions")
                if parsed.get("recommended_actions") is not None
                else parsed.get("actions")
            )
        else:
            summary = stripped
            overall_rating = None
            strengths = []
            weaknesses = []
            risk_flags = []
            recommended_actions = []

        if not summary:
            summary = "OpenClaw 已返回回测评审结果。"

        return {
            "summary": summary,
            "overall_rating": overall_rating or "acceptable",
            "strengths": strengths,
            "weaknesses": weaknesses,
            "risk_flags": risk_flags,
            "recommended_actions": recommended_actions,
            "raw_text": raw_text,
        }

    # ------------------------------------------------------------------
    # Execution impact (``summarize_execution_impact``)
    # ------------------------------------------------------------------
    # Canonical impact-level vocabulary for the post-decision execution
    # impact summary. Prompt emits one of ``negligible`` / ``moderate`` /
    # ``significant`` but agents frequently echo Chinese synonyms or
    # adjacent English terms; we normalize those here. Unknown values
    # degrade to ``"moderate"`` via
    # ``parse_execution_impact_response`` — the conservative middle
    # ground so downstream renderers neither under- nor over-sell an
    # ambiguous change.
    _EXECUTION_IMPACT_LEVEL_ALIASES: Dict[str, str] = {
        "negligible": "negligible",
        "small": "negligible",
        "tiny": "negligible",
        "minor": "negligible",
        "可忽略": "negligible",
        "忽略": "negligible",
        "轻微": "negligible",
        "moderate": "moderate",
        "normal": "moderate",
        "mid": "moderate",
        "medium": "moderate",
        "中等": "moderate",
        "一般": "moderate",
        "significant": "significant",
        "major": "significant",
        "large": "significant",
        "high": "significant",
        "critical": "significant",
        "显著": "significant",
        "重大": "significant",
    }

    # Canonical direction vocabulary (how the decision moved execution
    # quality / PnL). Unknown values degrade to ``"neutral"``.
    _EXECUTION_IMPACT_DIRECTION_ALIASES: Dict[str, str] = {
        "improved": "improved",
        "better": "improved",
        "positive": "improved",
        "up": "improved",
        "改善": "improved",
        "提升": "improved",
        "neutral": "neutral",
        "unchanged": "neutral",
        "flat": "neutral",
        "持平": "neutral",
        "中性": "neutral",
        "worsened": "worsened",
        "worse": "worsened",
        "negative": "worsened",
        "down": "worsened",
        "degraded": "worsened",
        "恶化": "worsened",
        "下降": "worsened",
    }

    @classmethod
    def _coerce_execution_impact_level(cls, value: Any) -> Optional[str]:
        if value is None:
            return None
        if isinstance(value, bool):
            return None
        if isinstance(value, (int, float)):
            return None
        token = str(value).strip().lower()
        if not token:
            return None
        if token in cls._EXECUTION_IMPACT_LEVEL_ALIASES:
            return cls._EXECUTION_IMPACT_LEVEL_ALIASES[token]
        for alias, canonical in cls._EXECUTION_IMPACT_LEVEL_ALIASES.items():
            if alias in token:
                return canonical
        return None

    @classmethod
    def _coerce_execution_impact_direction(cls, value: Any) -> Optional[str]:
        if value is None:
            return None
        if isinstance(value, bool):
            return None
        if isinstance(value, (int, float)):
            return None
        token = str(value).strip().lower()
        if not token:
            return None
        if token in cls._EXECUTION_IMPACT_DIRECTION_ALIASES:
            return cls._EXECUTION_IMPACT_DIRECTION_ALIASES[token]
        for alias, canonical in cls._EXECUTION_IMPACT_DIRECTION_ALIASES.items():
            if alias in token:
                return canonical
        return None

    @classmethod
    def parse_execution_impact_response(cls, text: Optional[str]) -> Dict[str, Any]:
        """Parse the structured response for a ``summarize_execution_impact`` agent job.

        Accepts either a JSON object of the form
        ``{"summary", "impact_level", "direction", "affected_orders",
        "affected_positions", "metrics_deltas", "follow_up_checks"}`` or
        a plain-text fallback. ``impact_level`` is normalized to one of
        ``negligible`` / ``moderate`` / ``significant`` and ``direction``
        to one of ``improved`` / ``neutral`` / ``worsened``; unknown
        values degrade to ``"moderate"`` and ``"neutral"`` respectively
        so downstream renderers never have to substitute a default
        themselves.

        The returned dict always contains ``summary``, ``impact_level``,
        ``direction``, ``affected_orders``, ``affected_positions``,
        ``metrics_deltas``, ``follow_up_checks`` and ``raw_text`` so the
        worker loop never has to branch on whether OpenClaw produced
        JSON.
        """

        raw_text = text if isinstance(text, str) else ""
        stripped = raw_text.strip()
        if not stripped:
            return {
                "summary": "",
                "impact_level": "moderate",
                "direction": "neutral",
                "affected_orders": [],
                "affected_positions": [],
                "metrics_deltas": [],
                "follow_up_checks": [],
                "raw_text": raw_text,
            }

        parsed = cls._extract_first_json_object(stripped)
        summary: str
        impact_level: Optional[str]
        direction: Optional[str]
        affected_orders: List[str]
        affected_positions: List[str]
        metrics_deltas: List[str]
        follow_up_checks: List[str]
        if isinstance(parsed, dict):
            summary = str(parsed.get("summary") or "").strip()
            impact_level = cls._coerce_execution_impact_level(
                parsed.get("impact_level")
                if parsed.get("impact_level") is not None
                else parsed.get("level")
            )
            direction = cls._coerce_execution_impact_direction(parsed.get("direction"))
            affected_orders_raw = parsed.get("affected_orders")
            if affected_orders_raw is None:
                affected_orders_raw = parsed.get("orders")
            if affected_orders_raw is None:
                affected_orders_raw = parsed.get("order_ids")
            affected_orders = cls._coerce_newline_string_list(affected_orders_raw)
            affected_positions_raw = parsed.get("affected_positions")
            if affected_positions_raw is None:
                affected_positions_raw = parsed.get("positions")
            if affected_positions_raw is None:
                affected_positions_raw = parsed.get("position_ids")
            affected_positions = cls._coerce_newline_string_list(affected_positions_raw)
            metrics_deltas_raw = parsed.get("metrics_deltas")
            if metrics_deltas_raw is None:
                metrics_deltas_raw = parsed.get("deltas")
            if metrics_deltas_raw is None:
                metrics_deltas_raw = parsed.get("metric_deltas")
            metrics_deltas = cls._coerce_newline_string_list(metrics_deltas_raw)
            follow_up_checks_raw = parsed.get("follow_up_checks")
            if follow_up_checks_raw is None:
                follow_up_checks_raw = parsed.get("checks")
            if follow_up_checks_raw is None:
                follow_up_checks_raw = parsed.get("follow_ups")
            follow_up_checks = cls._coerce_newline_string_list(follow_up_checks_raw)
        else:
            summary = stripped
            impact_level = None
            direction = None
            affected_orders = []
            affected_positions = []
            metrics_deltas = []
            follow_up_checks = []

        if not summary:
            summary = "OpenClaw 已返回执行影响摘要。"

        return {
            "summary": summary,
            "impact_level": impact_level or "moderate",
            "direction": direction or "neutral",
            "affected_orders": affected_orders,
            "affected_positions": affected_positions,
            "metrics_deltas": metrics_deltas,
            "follow_up_checks": follow_up_checks,
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
