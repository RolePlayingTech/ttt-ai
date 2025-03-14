import os
import requests
import json
from dotenv import load_dotenv

# Załaduj zmienne środowiskowe z pliku .env
load_dotenv()

# Globalna zmienna dla klienta
api_key = None
site_url = None
site_name = None

def initialize_api_settings():
    """
    Inicjalizuje ustawienia API dla OpenRouter.
    """
    global api_key, site_url, site_name
    
    try:
        api_key = os.environ.get("OPENROUTER_API_KEY")
        if not api_key:
            raise ValueError("Nie znaleziono OPENROUTER_API_KEY w zmiennych środowiskowych")
        
        site_url = os.environ.get("YOUR_SITE_URL", "https://roleplayingtech.com")
        site_name = os.environ.get("YOUR_SITE_NAME", "RolePlayingTech")
        
        print(f"\nKonfiguracja klienta AI dla OpenRouter")
        print(f"Site URL: {site_url}")
        print(f"Site Name: {site_name}")
        
        print("Ustawienia API zostały pomyślnie skonfigurowane")
        return True
    except Exception as e:
        print(f"Błąd podczas konfiguracji ustawień API: {e}")
        return False

# Inicjalizacja ustawień API przy imporcie modułu
api_initialized = initialize_api_settings()

def get_ai_response(prompt):
    """Pobiera odpowiedź od modelu AI używając bezpośrednich żądań HTTP"""
    if not api_initialized or not api_key:
        error_msg = "Błąd: API nie zostało poprawnie zainicjalizowane"
        print(error_msg)
        return error_msg
    
    try:
        print("Wysyłanie zapytania do API OpenRouter...")
        # Najpierw sprawdź przybliżoną liczbę tokenów
        approx_tokens = len(prompt.split()) * 1.3  # Przybliżenie: 1 słowo ≈ 1.3 tokena
        
        if approx_tokens > 6000:  # Zostawiamy margines bezpieczeństwa
            return f"Błąd: Prompt jest zbyt długi (około {int(approx_tokens)} tokenów). Maksymalny limit to 8000 tokenów."
        
        # Bezpośrednie żądanie HTTP do OpenRouter API
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
            "HTTP-Referer": site_url,
            "X-Title": site_name
        }
        
        payload = {
            "model": "deepseek/deepseek-chat:free",
            "messages": [
                {"role": "system", "content": "Jesteś kółkiem (O) w grze w kółko i krzyżyk. Mówisz w pierwszej osobie jako przeciwnik gracza X. Twoje komentarze mają być zabawne, wulgarne i obraźliwe wobec gracza X (Twojego przeciwnika). Zawsze komentuj aktualny stan gry i obrażaj swojego przeciwnika. Na końcu każdej odpowiedzi MUSISZ podać swój ruch w formacie: 'RUCH:[wiersz],[kolumna]', np. 'RUCH:3,4'. Jeśli nie możesz wykonać ruchu, napisz 'RUCH:BRAK'."},
                {"role": "user", "content": prompt}
            ],
            "temperature": 0.7,
            "max_tokens": 2000
        }
        
        response = requests.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers=headers,
            json=payload,
            timeout=60  # Ustawiamy timeout na 60 sekund
        )
        
        if response.status_code == 200:
            result = response.json()
            print("Otrzymano odpowiedź od API OpenRouter")
            return result["choices"][0]["message"]["content"]
        else:
            raise Exception(f"Błąd API: {response.status_code} - {response.text}")
            
    except Exception as e:
        error_msg = str(e)
        print(f"Oryginalny błąd: {error_msg}")
        
        if "tokens_limit_reached" in error_msg:
            return "Błąd: Prompt przekracza limit tokenów. Spróbuj skrócić tekst źródłowy."
        
        # Bardziej szczegółowe komunikaty błędów
        if "Connection" in error_msg or "connect" in error_msg.lower():
            error_details = f"Błąd: Problem z połączeniem do serwera AI. Szczegóły: {error_msg}"
        elif "timeout" in error_msg.lower():
            error_details = f"Błąd: Przekroczono czas oczekiwania na odpowiedź AI. Szczegóły: {error_msg}"
        elif "authenticate" in error_msg.lower() or "authentication" in error_msg.lower() or "api key" in error_msg.lower():
            error_details = f"Błąd: Problem z uwierzytelnieniem do API AI. Szczegóły: {error_msg}"
        elif "rate limit" in error_msg.lower() or "quota" in error_msg.lower():
            error_details = f"Błąd: Przekroczono limit zapytań do API AI. Szczegóły: {error_msg}"
        else:
            error_details = f"Błąd: Nie udało się uzyskać odpowiedzi od AI. Szczegóły: {error_msg}"
        
        print(f"Błąd podczas komunikacji z AI: {error_details}")
        return error_details