import requests

ODOO_URL = "https://navagost.odoo.com"
DATABASE = "navagost"
API_KEY = "82e63e18b637c263c395cc7e6bc382bd092e3bf6"

headers = {
    "Authorization": f"bearer {API_KEY}",
    "X-Odoo-Database": DATABASE,
    "Content-Type": "application/json",
}

payload = {
    "domain": [],
    "fields": ["name"],
    "limit": 5
}

response = requests.post(
    f"{ODOO_URL}/json/2/res.partner/search_read",
    headers=headers,
    json=payload
)

print(response.status_code)
print(response.text)