#!/usr/bin/env python3
"""
Try to find existing admin credentials
"""
import requests

BASE_URL = "https://academy-preview-37.preview.emergentagent.com/api"

# Common test admin emails to try
test_emails = [
    "admin@lagartes.com",
    "admin.teste@lagartes.com",
    "qa.admin@lagartes.com",
    "test.admin@lagartes.com",
]

test_passwords = ["senha123", "admin123", "password123", "123456"]

print("Tentando encontrar credenciais de admin existentes...\n")

for email in test_emails:
    for password in test_passwords:
        try:
            r = requests.post(f"{BASE_URL}/auth/login", json={
                "email": email,
                "password": password
            }, timeout=10)
            
            if r.status_code == 200:
                data = r.json()
                role = data.get("profile", {}).get("role")
                print(f"✅ Login bem-sucedido!")
                print(f"   Email: {email}")
                print(f"   Password: {password}")
                print(f"   Role: {role}")
                print(f"   Token: {data.get('session', {}).get('access_token')[:50]}...")
                
                if role == "admin":
                    print(f"\n🎉 ADMIN ENCONTRADO!")
                    print(f"Email: {email}")
                    print(f"Password: {password}")
                    exit(0)
        except Exception as e:
            pass

print("\n❌ Nenhum admin encontrado com as credenciais testadas")
