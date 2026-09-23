#!/usr/bin/env python3
"""
Teste dos NOVOS endpoints de armazenamento de vídeo (Supabase Storage) da plataforma LAGARTES ACADEMY.
Inclui smoke test dos fluxos antigos.
"""
import requests
import json
import uuid
from datetime import datetime

# Backend URL from .env
BASE_URL = "https://academy-preview-37.preview.emergentagent.com/api"

# Test data storage
test_data = {
    "admin_token": None,
    "student_token": None,
    "admin_email": None,
    "student_email": None,
    "created_users": [],  # Track users to delete at the end
}

def log(msg):
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}")

def test_result(name, passed, details=""):
    status = "✅ PASSOU" if passed else "❌ FALHOU"
    log(f"{status} - {name}")
    if details:
        log(f"  Detalhes: {details}")
    return passed

# ========== Setup: Create admin and student users ==========
def setup_users():
    log("\n========== SETUP: Criando usuários de teste ==========")
    
    # Try to create admin user
    timestamp = int(datetime.now().timestamp())
    admin_email = f"qa.admin.{timestamp}@lagartes.com"
    admin_password = "senha123"
    
    log(f"Tentando criar admin: {admin_email}")
    try:
        r = requests.post(f"{BASE_URL}/auth/signup", json={
            "email": admin_email,
            "password": admin_password,
            "full_name": "QA Admin"
        }, timeout=30)
        
        log(f"Signup status: {r.status_code}")
        log(f"Signup response: {r.text[:500]}")
        
        if r.status_code in [200, 201]:
            data = r.json()
            role = data.get("profile", {}).get("role")
            log(f"Usuário criado com role: {role}")
            
            if role == "admin":
                test_data["admin_token"] = data.get("session", {}).get("access_token")
                test_data["admin_email"] = admin_email
                test_data["created_users"].append({
                    "id": data.get("user", {}).get("id"),
                    "email": admin_email
                })
                log(f"✅ Admin criado com sucesso: {admin_email}")
            elif role == "student":
                log(f"⚠️  Usuário criado como STUDENT (já existe admin no banco)")
                test_data["student_token"] = data.get("session", {}).get("access_token")
                test_data["student_email"] = admin_email
                test_data["created_users"].append({
                    "id": data.get("user", {}).get("id"),
                    "email": admin_email
                })
                
                # Try to create another user as student
                student_email = f"qa.student.{timestamp}@lagartes.com"
                log(f"Criando segundo usuário (student): {student_email}")
                r2 = requests.post(f"{BASE_URL}/auth/signup", json={
                    "email": student_email,
                    "password": "senha123",
                    "full_name": "QA Student"
                }, timeout=30)
                
                if r2.status_code in [200, 201]:
                    data2 = r2.json()
                    if not test_data["student_token"]:
                        test_data["student_token"] = data2.get("session", {}).get("access_token")
                        test_data["student_email"] = student_email
                    test_data["created_users"].append({
                        "id": data2.get("user", {}).get("id"),
                        "email": student_email
                    })
        else:
            log(f"❌ Erro ao criar usuário: {r.text}")
            
    except requests.exceptions.Timeout:
        log(f"❌ Timeout ao criar usuário (30s)")
        log(f"⚠️  Continuando testes sem criar novos usuários")
    except Exception as e:
        log(f"❌ Exceção ao criar usuário: {str(e)}")
    
    log(f"\nStatus do setup:")
    log(f"  Admin token: {'✅ Disponível' if test_data['admin_token'] else '❌ Não disponível'}")
    log(f"  Student token: {'✅ Disponível' if test_data['student_token'] else '❌ Não disponível'}")
    log(f"  Usuários criados: {len(test_data['created_users'])}")

# ========== 1. POST /api/storage/upload-url SEM token → 401 ==========
def test_upload_url_no_token():
    log("\n========== 1. POST /api/storage/upload-url SEM token → deve retornar 401 ==========")
    try:
        uuid1 = str(uuid.uuid4())
        uuid2 = str(uuid.uuid4())
        payload = {
            "objectPath": f"lessons/{uuid1}/{uuid2}.mp4",
            "contentType": "video/mp4"
        }
        
        r = requests.post(f"{BASE_URL}/storage/upload-url", json=payload, timeout=10)
        log(f"Status: {r.status_code}")
        log(f"Response: {r.text[:200]}")
        
        if r.status_code == 401:
            return test_result("Upload URL sem token", True, "Retornou 401 como esperado")
        else:
            return test_result("Upload URL sem token", False, f"Expected 401, got {r.status_code}")
    except Exception as e:
        return test_result("Upload URL sem token", False, str(e))

# ========== 2. POST /api/storage/upload-url com token STUDENT → 403 ==========
def test_upload_url_student_token():
    log("\n========== 2. POST /api/storage/upload-url com token STUDENT → deve retornar 403 ==========")
    
    if not test_data["student_token"]:
        log("⚠️  Token de student não disponível, pulando teste")
        return test_result("Upload URL com token student", False, "Token de student não disponível")
    
    try:
        uuid1 = str(uuid.uuid4())
        uuid2 = str(uuid.uuid4())
        payload = {
            "objectPath": f"lessons/{uuid1}/{uuid2}.mp4",
            "contentType": "video/mp4"
        }
        
        headers = {"Authorization": f"Bearer {test_data['student_token']}"}
        r = requests.post(f"{BASE_URL}/storage/upload-url", json=payload, headers=headers, timeout=10)
        log(f"Status: {r.status_code}")
        log(f"Response: {r.text[:200]}")
        
        if r.status_code == 403:
            return test_result("Upload URL com token student", True, "Retornou 403 como esperado (só admin)")
        else:
            return test_result("Upload URL com token student", False, f"Expected 403, got {r.status_code}")
    except Exception as e:
        return test_result("Upload URL com token student", False, str(e))

# ========== 3. POST /api/storage/upload-url com token ADMIN e path válido → 200 ==========
def test_upload_url_admin_valid():
    log("\n========== 3. POST /api/storage/upload-url com token ADMIN e path válido → deve retornar 200 ==========")
    
    if not test_data["admin_token"]:
        log("⚠️  Token de admin não disponível")
        return test_result("Upload URL com token admin (válido)", False, "Token de admin não disponível - não foi possível criar admin")
    
    try:
        uuid1 = str(uuid.uuid4())
        uuid2 = str(uuid.uuid4())
        payload = {
            "objectPath": f"lessons/{uuid1}/{uuid2}.mp4",
            "contentType": "video/mp4"
        }
        
        log(f"Payload: {json.dumps(payload, indent=2)}")
        headers = {"Authorization": f"Bearer {test_data['admin_token']}"}
        r = requests.post(f"{BASE_URL}/storage/upload-url", json=payload, headers=headers, timeout=10)
        log(f"Status: {r.status_code}")
        log(f"Response: {r.text[:500]}")
        
        if r.status_code == 200:
            data = r.json()
            has_path = "path" in data
            has_token = "token" in data
            has_signed_url = "signedUrl" in data
            
            log(f"  Campos retornados:")
            log(f"    - path: {'✅' if has_path else '❌'}")
            log(f"    - token: {'✅' if has_token else '❌'}")
            log(f"    - signedUrl: {'✅' if has_signed_url else '❌'}")
            
            if has_path and has_token and has_signed_url:
                return test_result("Upload URL com token admin (válido)", True, 
                                 f"Retornou 200 com os 3 campos necessários. Bucket 'lesson-videos' criado/verificado.")
            else:
                missing = []
                if not has_path: missing.append("path")
                if not has_token: missing.append("token")
                if not has_signed_url: missing.append("signedUrl")
                return test_result("Upload URL com token admin (válido)", False, 
                                 f"Campos ausentes: {', '.join(missing)}")
        else:
            return test_result("Upload URL com token admin (válido)", False, 
                             f"Expected 200, got {r.status_code}: {r.text[:200]}")
    except Exception as e:
        return test_result("Upload URL com token admin (válido)", False, str(e))

# ========== 4. POST /api/storage/upload-url com paths INVÁLIDOS → 400 ==========
def test_upload_url_invalid_paths():
    log("\n========== 4. POST /api/storage/upload-url com paths INVÁLIDOS → deve retornar 400 ==========")
    
    if not test_data["admin_token"]:
        log("⚠️  Token de admin não disponível")
        return test_result("Upload URL com paths inválidos", False, "Token de admin não disponível")
    
    invalid_paths = [
        "arquivo.txt",
        "../../etc/passwd",
        "lessons/x/y.exe",
        "lessons/abc.mp4",
        "videos/test.mp4",
        "lessons//test.mp4"
    ]
    
    headers = {"Authorization": f"Bearer {test_data['admin_token']}"}
    all_passed = True
    
    for invalid_path in invalid_paths:
        try:
            payload = {"objectPath": invalid_path, "contentType": "video/mp4"}
            r = requests.post(f"{BASE_URL}/storage/upload-url", json=payload, headers=headers, timeout=10)
            log(f"  Path: {invalid_path}")
            log(f"    Status: {r.status_code}, Response: {r.text[:100]}")
            
            if r.status_code != 400:
                log(f"    ❌ Expected 400, got {r.status_code}")
                all_passed = False
            else:
                data = r.json()
                if "Caminho inválido" in data.get("error", ""):
                    log(f"    ✅ Retornou 400 com mensagem correta")
                else:
                    log(f"    ⚠️  Retornou 400 mas mensagem diferente: {data.get('error')}")
        except Exception as e:
            log(f"    ❌ Exceção: {str(e)}")
            all_passed = False
    
    return test_result("Upload URL com paths inválidos", all_passed, 
                      "Todos os paths inválidos retornaram 400" if all_passed else "Alguns paths não retornaram 400")

# ========== 5. POST /api/storage/playback-url SEM token → 401 ==========
def test_playback_url_no_token():
    log("\n========== 5. POST /api/storage/playback-url SEM token → deve retornar 401 ==========")
    try:
        payload = {"objectPath": "lessons/test/video.mp4"}
        r = requests.post(f"{BASE_URL}/storage/playback-url", json=payload, timeout=10)
        log(f"Status: {r.status_code}")
        log(f"Response: {r.text[:200]}")
        
        if r.status_code == 401:
            return test_result("Playback URL sem token", True, "Retornou 401 como esperado")
        else:
            return test_result("Playback URL sem token", False, f"Expected 401, got {r.status_code}")
    except Exception as e:
        return test_result("Playback URL sem token", False, str(e))

# ========== 6. POST /api/storage/playback-url com token e path inexistente ==========
def test_playback_url_nonexistent():
    log("\n========== 6. POST /api/storage/playback-url com token e path inexistente ==========")
    
    # Use student token if available, otherwise admin
    token = test_data["student_token"] or test_data["admin_token"]
    
    if not token:
        log("⚠️  Nenhum token disponível")
        return test_result("Playback URL com path inexistente", False, "Nenhum token disponível")
    
    try:
        payload = {"objectPath": "lessons/inexistente/naoexiste.mp4"}
        headers = {"Authorization": f"Bearer {token}"}
        r = requests.post(f"{BASE_URL}/storage/playback-url", json=payload, headers=headers, timeout=10)
        log(f"Status: {r.status_code}")
        log(f"Response: {r.text[:500]}")
        
        if r.status_code == 400:
            return test_result("Playback URL com path inexistente", True, 
                             "Retornou 400 (erro do Supabase - objeto não existe) - comportamento aceitável")
        elif r.status_code == 200:
            data = r.json()
            if "url" in data:
                return test_result("Playback URL com path inexistente", True, 
                                 "Retornou 200 com URL (Supabase gerou URL mesmo sem objeto) - comportamento aceitável")
            else:
                return test_result("Playback URL com path inexistente", False, 
                                 "Retornou 200 mas sem campo 'url'")
        elif r.status_code == 500:
            return test_result("Playback URL com path inexistente", False, 
                             "❌ BUG: Retornou 500 (erro interno do servidor)")
        else:
            return test_result("Playback URL com path inexistente", True, 
                             f"Retornou {r.status_code} - não é 500, então aceitável")
    except Exception as e:
        return test_result("Playback URL com path inexistente", False, str(e))

# ========== SMOKE TESTS ==========

def test_smoke_health():
    log("\n========== SMOKE TEST 7: GET /api/health → 200 mode:'supabase' ==========")
    try:
        r = requests.get(f"{BASE_URL}/health", timeout=10)
        log(f"Status: {r.status_code}")
        log(f"Response: {r.text}")
        
        if r.status_code != 200:
            return test_result("Smoke: Health", False, f"Expected 200, got {r.status_code}")
        
        data = r.json()
        if data.get("mode") != "supabase":
            return test_result("Smoke: Health", False, f"Expected mode 'supabase', got '{data.get('mode')}'")
        
        return test_result("Smoke: Health", True, "API em modo supabase funcionando")
    except Exception as e:
        return test_result("Smoke: Health", False, str(e))

def test_smoke_home():
    log("\n========== SMOKE TEST 8: GET /api/home (sem token) → 200 ==========")
    try:
        r = requests.get(f"{BASE_URL}/home", timeout=10)
        log(f"Status: {r.status_code}")
        log(f"Response: {r.text}")
        
        if r.status_code != 200:
            return test_result("Smoke: Home", False, f"Expected 200, got {r.status_code}")
        
        return test_result("Smoke: Home", True, "Home público funcionando")
    except Exception as e:
        return test_result("Smoke: Home", False, str(e))

def test_smoke_courses_and_me():
    log("\n========== SMOKE TEST 9: GET /api/courses e /api/auth/me com token ==========")
    
    token = test_data["admin_token"] or test_data["student_token"]
    if not token:
        log("⚠️  Nenhum token disponível")
        return test_result("Smoke: Courses e Me", False, "Nenhum token disponível")
    
    try:
        headers = {"Authorization": f"Bearer {token}"}
        
        # Test /api/courses
        log("Testando GET /api/courses...")
        r = requests.get(f"{BASE_URL}/courses", headers=headers, timeout=10)
        log(f"Status: {r.status_code}")
        log(f"Response: {r.text[:500]}")
        
        if r.status_code != 200:
            return test_result("Smoke: Courses", False, f"Expected 200, got {r.status_code}")
        
        courses = r.json()
        corel_course = None
        for course in courses:
            if "CorelDRAW" in course.get("title", ""):
                corel_course = course
                break
        
        if not corel_course:
            log("⚠️  Curso 'CorelDRAW do Zero' não encontrado")
        else:
            log(f"✅ Curso encontrado: {corel_course.get('title')}")
            log(f"   lessons_count: {corel_course.get('lessons_count')}")
            if corel_course.get('lessons_count') != 3:
                log(f"⚠️  Expected lessons_count=3, got {corel_course.get('lessons_count')}")
        
        # Test /api/auth/me
        log("\nTestando GET /api/auth/me...")
        r2 = requests.get(f"{BASE_URL}/auth/me", headers=headers, timeout=10)
        log(f"Status: {r2.status_code}")
        log(f"Response: {r2.text[:300]}")
        
        if r2.status_code != 200:
            return test_result("Smoke: Me", False, f"Expected 200, got {r2.status_code}")
        
        return test_result("Smoke: Courses e Me", True, "Ambos endpoints funcionando")
    except Exception as e:
        return test_result("Smoke: Courses e Me", False, str(e))

# ========== Cleanup: Delete test users ==========
def cleanup_users():
    log("\n========== CLEANUP: Deletando usuários de teste ==========")
    
    if not test_data["admin_token"]:
        log("⚠️  Token de admin não disponível, não é possível deletar usuários")
        log(f"Usuários criados que precisam ser deletados manualmente:")
        for user in test_data["created_users"]:
            log(f"  - {user['email']} (ID: {user['id']})")
        return
    
    headers = {"Authorization": f"Bearer {test_data['admin_token']}"}
    
    for user in test_data["created_users"]:
        try:
            log(f"Deletando usuário: {user['email']} (ID: {user['id']})")
            r = requests.delete(f"{BASE_URL}/users/{user['id']}", headers=headers, timeout=10)
            log(f"  Status: {r.status_code}")
            if r.status_code in [200, 204]:
                log(f"  ✅ Usuário deletado com sucesso")
            else:
                log(f"  ⚠️  Falha ao deletar: {r.text[:200]}")
        except Exception as e:
            log(f"  ❌ Exceção ao deletar: {str(e)}")

# ========== Main Test Runner ==========
def main():
    log("=" * 80)
    log("TESTE DOS ENDPOINTS DE STORAGE (SUPABASE) - LAGARTES ACADEMY")
    log("=" * 80)
    
    results = []
    
    # Setup
    setup_users()
    
    # New storage endpoint tests
    results.append(test_upload_url_no_token())
    results.append(test_upload_url_student_token())
    results.append(test_upload_url_admin_valid())
    results.append(test_upload_url_invalid_paths())
    results.append(test_playback_url_no_token())
    results.append(test_playback_url_nonexistent())
    
    # Smoke tests
    results.append(test_smoke_health())
    results.append(test_smoke_home())
    results.append(test_smoke_courses_and_me())
    
    # Cleanup
    cleanup_users()
    
    # Summary
    log("\n" + "=" * 80)
    log("RESUMO DOS TESTES")
    log("=" * 80)
    passed = sum(results)
    total = len(results)
    log(f"Total: {passed}/{total} testes passaram")
    log(f"Taxa de sucesso: {(passed/total*100):.1f}%")
    
    if passed == total:
        log("\n✅ TODOS OS TESTES PASSARAM!")
    else:
        log(f"\n⚠️  {total - passed} teste(s) falharam")
    
    log("=" * 80)

if __name__ == "__main__":
    main()
