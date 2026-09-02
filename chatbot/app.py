"""
chatbot/app.py
==============
Servidor Flask del chatbot Navagost-Odoo.
Stateless: el historial de conversación viaja en el cliente (JSON),
lo que permite desplegar en plataformas serverless (Vercel, etc.).

Arranca desde la raíz del repo:
    python3.11 run.py

Rutas:
  GET  /         → interfaz web
  POST /chat     → { message, history } → Gemini → { reply, history, tool_calls }
  POST /reset    → no-op (compatibilidad con cliente antiguo)
"""

import os
import json
from flask import Flask, render_template, request, jsonify
from dotenv import load_dotenv
from google import genai
from google.genai import types

from chatbot.odoo_tools import ALL_TOOLS, TOOLS_MAP
from chatbot.prompts import SYSTEM_PROMPT

load_dotenv()

GEMINI_KEY   = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

# Flask busca templates en chatbot/templates/
app = Flask(__name__, template_folder="templates")
app.secret_key = os.urandom(24)


# ─── Gemini config ────────────────────────────────────────────────────────────

def _gemini_config() -> types.GenerateContentConfig:
    return types.GenerateContentConfig(
        system_instruction=SYSTEM_PROMPT,
        tools=ALL_TOOLS,
        automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
    )


def _build_contents(history: list, user_msg: str) -> list:
    """
    Reconstruye la lista de Content de Gemini a partir del historial del cliente.
    history = [{"role": "user"|"model", "text": "..."}]
    """
    contents = []
    for turn in history:
        role = turn.get("role", "user")
        text = turn.get("text", "")
        if text:
            contents.append(types.Content(role=role, parts=[types.Part(text=text)]))
    contents.append(types.Content(role="user", parts=[types.Part(text=user_msg)]))
    return contents


# ─── rutas ────────────────────────────────────────────────────────────────────

@app.route("/")
def index():
    return render_template("index.html",
                           gemini_ok=bool(GEMINI_KEY),
                           model=GEMINI_MODEL)


@app.route("/chat", methods=["POST"])
def chat():
    if not GEMINI_KEY:
        return jsonify({"error": "Falta GEMINI_API_KEY en el servidor"}), 500

    data     = request.json or {}
    user_msg = (data.get("message") or "").strip()
    history  = data.get("history") or []   # lista de {role, text} del cliente

    if not user_msg:
        return jsonify({"error": "Mensaje vacío"}), 400

    client         = genai.Client(api_key=GEMINI_KEY)
    tool_calls_log: list = []

    contents = _build_contents(history, user_msg)
    config   = _gemini_config()

    try:
        while True:
            response  = client.models.generate_content(
                model=GEMINI_MODEL, contents=contents, config=config,
            )
            candidate = response.candidates[0]
            contents.append(candidate.content)

            fn_calls = [p for p in candidate.content.parts
                        if hasattr(p, "function_call") and p.function_call]
            if not fn_calls:
                break

            fn_response_parts = []
            for part in fn_calls:
                fc    = part.function_call
                fname = fc.name
                fargs = dict(fc.args) if fc.args else {}
                tool_calls_log.append({"fn": fname, "args": fargs})

                try:
                    result = TOOLS_MAP[fname](**fargs)
                except Exception as exc:
                    result = json.dumps({"error": str(exc)})

                fn_response_parts.append(types.Part(
                    function_response=types.FunctionResponse(
                        name=fname, response={"result": result},
                    )
                ))
            contents.append(types.Content(role="user", parts=fn_response_parts))

        reply = "".join(
            p.text for p in candidate.content.parts
            if hasattr(p, "text") and p.text
        )

        # devolver historial actualizado al cliente (solo texto)
        new_history = history + [
            {"role": "user",  "text": user_msg},
            {"role": "model", "text": reply},
        ]

        return jsonify({"reply": reply, "tool_calls": tool_calls_log, "history": new_history})

    except Exception as exc:
        msg = str(exc)
        # detectar rate limit y extraer segundos de espera
        retry_after = None
        if "RESOURCE_EXHAUSTED" in msg or "429" in msg:
            import re
            m = re.search(r'retryDelay.*?(\d+)s', msg)
            retry_after = int(m.group(1)) if m else 60
        return jsonify({"error": msg, "retry_after": retry_after}), 500


@app.route("/reset", methods=["POST"])
def reset():
    return jsonify({"ok": True})
