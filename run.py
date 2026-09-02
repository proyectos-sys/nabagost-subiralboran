"""
run.py
======
Punto de entrada para arrancar el chatbot web.

Uso:
    python3.11 run.py
    python3.11 run.py --port 8080

Abre en el navegador:  http://localhost:5000
"""

import argparse
from chatbot.app import app

if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--port", type=int, default=5000)
    p.add_argument("--host", default="127.0.0.1")
    args = p.parse_args()

    print(f"\n  Chatbot Navagost-Odoo")
    print(f"  Abre: http://{args.host}:{args.port}\n")
    app.run(debug=True, host=args.host, port=args.port)
