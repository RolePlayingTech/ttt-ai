# Efektowna Gra Kółko i Krzyżyk 3D

Imponująca gra w kółko i krzyżyk 3D na planszy 10x10 z wykorzystaniem Three.js i AI do komentowania ruchów.

## Funkcje

- Efektowna grafika 3D z wykorzystaniem Three.js
- Plansza 10x10 z warunkiem wygranej 5 w rzędzie
- Imponujące animacje i efekty cząsteczkowe
- Komentarze AI po każdym ruchu
- Różne widoki kamery
- Możliwość włączania/wyłączania animacji

## Wymagania

- Python 3.7+
- Przeglądarka internetowa obsługująca WebGL

## Instalacja

1. Zainstaluj wymagane pakiety Python:

```
pip install -r requirements.txt
```

## Uruchamianie

1. Uruchom serwer Flask:

```
python server.py
```

2. Otwórz przeglądarkę i przejdź pod adres:

```
http://localhost:5000
```

## Sterowanie

- **Kliknięcie myszą** - wykonanie ruchu
- **Nowa Gra** - resetuje planszę
- **Wstrzymaj Animacje** - włącza/wyłącza animacje
- **Zmień Kamerę** - przełącza między różnymi widokami kamery

## Technologie

- Three.js - renderowanie 3D
- GSAP - animacje
- Flask - serwer backend
- AI - komentarze do gry

## Jak działa integracja z AI

Gra wykorzystuje moduł `ai_client.py` do komunikacji z AI. Po każdym ruchu, stan planszy jest wysyłany do AI, które generuje komentarz sportowy opisujący aktualną sytuację na planszy. Komentarze są wyświetlane w interfejsie gry.
