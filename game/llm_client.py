import httpx
import asyncio
from typing import Optional

from game.config import (
    LLM_MAX_TOKENS,
    LLM_TEMPERATURE,
    LLM_NORMAL_TIMEOUT,
    LLM_THINKING_TIMEOUT,
    LLM_THINKING_MODEL_KEYWORDS,
)
from logger import log_model_call, log_warning


class LLMClientMixin:

    def _get_client_config(self):
        cfg = self.player.model_config

        if cfg.provider_id and cfg.provider_id in self.providers:
            provider = self.providers[cfg.provider_id]
            if provider.get("api_key") and provider.get("api_url"):
                return provider, cfg.provider_id
            else:
                log_warning(
                    context=f"指定的模型供应商配置不完整: player={self.player.name}, provider_id={cfg.provider_id}, has_api_key={bool(provider.get('api_key'))}, has_api_url={bool(provider.get('api_url'))}"
                )

        for pid, prov in self.providers.items():
            api_key = prov.get("api_key", "")
            api_url = prov.get("api_url", "")
            if api_key and api_url:
                return prov, pid

        provider_count = len(self.providers)
        provider_ids = list(self.providers.keys())[:5]
        log_warning(
            context=f"没有找到有效的模型供应商: player={self.player.name}, provider_count={provider_count}, provider_ids={provider_ids}"
        )
        return None, None

    async def call_llm(self, system_prompt: str, user_prompt: str, max_retries: int = 3) -> dict:
        provider, pid = self._get_client_config()
        if not provider:
            return {"content": "无法调用 AI 模型：未配置模型供应商", "reasoning": ""}

        cfg = self.player.model_config
        model_name = (cfg.model_name or provider.get("default_model", "gpt-3.5-turbo")).strip()
        api_url = provider.get("api_url", "").rstrip("/")
        api_key = provider.get("api_key", "")

        if not api_url:
            return {"content": "无法调用 AI 模型：未配置 API 地址", "reasoning": ""}

        if "/v1" not in api_url:
            api_url = f"{api_url}/v1"

        url = f"{api_url}/chat/completions"
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        }
        payload = {
            "model": model_name,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "max_tokens": LLM_MAX_TOKENS,
            "temperature": LLM_TEMPERATURE,
        }

        last_error = None
        for attempt in range(max_retries):
            try:
                import time
                start_time = time.time()

                log_model_call(self.player.name, model_name, "调用中")

                is_thinking_model = any(keyword in model_name.lower() for keyword in LLM_THINKING_MODEL_KEYWORDS)
                timeout = LLM_THINKING_TIMEOUT if is_thinking_model else LLM_NORMAL_TIMEOUT

                async with httpx.AsyncClient(timeout=timeout) as client:
                    resp = await client.post(url, headers=headers, json=payload)
                    duration = time.time() - start_time

                    if resp.status_code != 200:
                        error_text = resp.text[:500]
                        log_model_call(self.player.name, model_name, f"失败 ({resp.status_code})")
                        log_warning(
                            context=f"模型 API 调用失败: player={self.player.name}, model={model_name}, url={url}, status={resp.status_code}, response={error_text}"
                        )
                        if resp.status_code in (429, 500, 502, 503, 504) and attempt < max_retries - 1:
                            wait_time = 2 ** attempt
                            log_warning(context=f"API 限流/服务器错误，{wait_time}秒后重试 ({attempt+1}/{max_retries})")
                            await asyncio.sleep(wait_time)
                            continue
                        return {"content": f"模型调用失败 ({resp.status_code})：{error_text}", "reasoning": ""}

                    data = resp.json()

                    if not data.get("choices") or len(data["choices"]) == 0:
                        log_model_call(self.player.name, model_name, "空响应", duration)
                        if attempt < max_retries - 1:
                            await asyncio.sleep(2 ** attempt)
                            continue
                        return {"content": f"模型返回空响应，原始数据：{str(data)[:200]}", "reasoning": ""}

                    choice = data["choices"][0]

                    content = ""
                    reasoning = ""

                    if "message" in choice:
                        message = choice["message"]
                        content = (message.get("content") or "").strip()

                        if not content:
                            for key in ["text", "output", "response"]:
                                if message.get(key):
                                    content = message[key].strip()
                                    break

                        for key in ["reasoning_content", "reasoning", "thoughts", "thinking"]:
                            if message.get(key):
                                reasoning = message[key].strip()
                                if not content:
                                    content = reasoning
                                break

                    elif "text" in choice:
                        content = choice["text"].strip()

                    elif "delta" in choice:
                        content = (choice["delta"].get("content") or "").strip()

                    if not content:
                        log_model_call(self.player.name, model_name, "格式错误", duration)
                        debug_info = {
                            "has_message": "message" in choice,
                            "message_keys": list(choice.get("message", {}).keys()) if "message" in choice else [],
                            "choice_keys": list(choice.keys()),
                            "raw_preview": str(choice)[:300]
                        }
                        if attempt < max_retries - 1:
                            await asyncio.sleep(2 ** attempt)
                            continue
                        return {"content": f"模型返回格式错误，原始数据：{debug_info}", "reasoning": ""}

                    log_model_call(self.player.name, model_name, "成功", duration)
                    return {"content": content, "reasoning": reasoning}
            except httpx.TimeoutException:
                last_error = "思考时间过长，暂时无法回应。"
                log_model_call(self.player.name, model_name, "超时")
                if attempt < max_retries - 1:
                    wait_time = 2 ** attempt * 2
                    log_warning(context=f"API 超时，{wait_time}秒后重试 ({attempt+1}/{max_retries})")
                    await asyncio.sleep(wait_time)
            except httpx.HTTPStatusError as e:
                last_error = f"模型调用失败 ({e.response.status_code})：{e.response.text[:300]}"
                log_model_call(self.player.name, model_name, f"HTTP 错误 ({e.response.status_code})")
                if attempt < max_retries - 1:
                    await asyncio.sleep(2 ** attempt)
            except Exception as e:
                last_error = f"模型调用出错：{str(e)[:100]}"
                log_model_call(self.player.name, model_name, f"异常：{str(e)[:50]}")
                if attempt < max_retries - 1:
                    await asyncio.sleep(2 ** attempt)

        return {"content": last_error or "模型调用失败，已重试多次", "reasoning": ""}
