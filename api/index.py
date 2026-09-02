"""
api/index.py  –  Punto de entrada para Vercel
==============================================
Vercel ejecuta este archivo como función serverless.
Importa la app Flask desde chatbot/ y la expone como handler WSGI.
"""
import sys
import os

# Asegurar que el raíz del proyecto esté en el path de importación
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from chatbot.app import app

# Vercel espera el objeto 'app' como handler WSGI
