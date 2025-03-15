from flask import Flask, request, jsonify, send_from_directory
import os
import sys
from ai_client import get_ai_response

# Utwórz aplikację Flask z prawidłową konfiguracją dla plików statycznych
app = Flask(__name__, static_folder='.', static_url_path='')

@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/<path:path>')
def static_files(path):
    return send_from_directory('.', path)

@app.route('/get-ai-commentary', methods=['POST'])
def get_ai_commentary():
    try:
        data = request.json
        prompt = data.get('prompt', '')
        
        if not prompt:
            return jsonify({'error': 'Brak promptu'}), 400
        
        # Dodaj analityczne informacje do promptu dla lepszej strategii
        if "Stan planszy" in prompt:
            # Analizuj pozycję planszy i dodaj wskazówki strategiczne
            enhanced_prompt = enhance_prompt_with_strategy(prompt)
            # Użyj ulepszonego promptu jeśli został wygenerowany
            if enhanced_prompt:
                prompt = enhanced_prompt
        
        # Użycie funkcji z ai_client.py do pobrania odpowiedzi od AI
        commentary = get_ai_response(prompt)
        
        # Sprawdzenie, czy odpowiedź zawiera informację o błędzie
        if "Błąd:" in commentary and "RUCH:" not in commentary:
            error_details = commentary
            print(f"Błąd AI: {error_details}", file=sys.stderr)
            return jsonify({'error': error_details}), 500
        
        # Parsowanie ruchu z odpowiedzi AI
        ai_move = None
        move_marker = "RUCH:"
        
        if move_marker in commentary:
            # Znajdź pozycję markera ruchu
            move_start = commentary.find(move_marker) + len(move_marker)
            move_end = commentary.find("\n", move_start) if "\n" in commentary[move_start:] else len(commentary)
            move_text = commentary[move_start:move_end].strip()
            
            print(f"Znaleziono ruch AI: {move_text}")
            
            # Jeśli nie jest to BRAK, spróbuj sparsować współrzędne
            if move_text != "BRAK":
                try:
                    row, col = map(int, move_text.split(','))
                    ai_move = {'row': row, 'col': col}
                    print(f"Sparsowany ruch AI: wiersz={row}, kolumna={col}")
                except Exception as e:
                    print(f"Błąd podczas parsowania ruchu AI: {e}", file=sys.stderr)
                    # Awaryjny ruch w przypadku błędu parsowania
                    ai_move = {'row': 5, 'col': 5}
                    print(f"Ustawiono awaryjny ruch AI: wiersz=5, kolumna=5")
            
            # Usuń marker ruchu z komentarza
            commentary = commentary[:commentary.find(move_marker)].strip()
        else:
            # Jeśli nie znaleziono markera RUCH:, ustaw domyślny ruch
            print("Nie znaleziono markera RUCH: w odpowiedzi AI, ustawiam domyślny ruch")
            ai_move = {'row': 5, 'col': 5}
        
        # Jeśli commentary zawiera "Błąd", ale mamy ruch, usuń informację o błędzie z komentarza
        if "Błąd:" in commentary and ai_move:
            commentary = "Coś się zjebało z API, ale i tak zagram!"
        
        return jsonify({
            'commentary': commentary,
            'ai_move': ai_move
        })
    except Exception as e:
        error_details = f"Błąd podczas przetwarzania zapytania AI: {str(e)}"
        print(error_details, file=sys.stderr)
        return jsonify({'error': error_details}), 500

# Funkcja do znajdowania zagrożeń na planszy
def find_threats(board, player):
    threats = []
    directions = [
        {"name": "poziomo", "dr": 0, "dc": 1},
        {"name": "pionowo", "dr": 1, "dc": 0},
        {"name": "ukośnie ↗", "dr": -1, "dc": 1},
        {"name": "ukośnie ↘", "dr": 1, "dc": 1}
    ]
    
    board_size = len(board)
    min_threat = 3  # Minimalna liczba znaków w rzędzie, aby uznać za zagrożenie
    
    # 1. Sprawdź sekwencje znaków w rzędzie
    for row in range(board_size):
        for col in range(board_size):
            if board[row][col] == player:
                for direction in directions:
                    # Sprawdź sekwencję w tym kierunku
                    count = 1
                    r, c = row, col
                    
                    # Sprawdź w przód
                    for i in range(1, 5):  # Sprawdź do 5 kroków w przód
                        r += direction["dr"]
                        c += direction["dc"]
                        if 0 <= r < board_size and 0 <= c < board_size and board[r][c] == player:
                            count += 1
                        else:
                            break
                    
                    # Jeśli znaleziono wystarczająco dużo znaków, sprawdź czy jest otwarte miejsce do kontynuacji
                    if count >= min_threat:
                        # Sprawdź miejsce do blokady
                        block_row = r
                        block_col = c
                        
                        if 0 <= block_row < board_size and 0 <= block_col < board_size and board[block_row][block_col] is None:
                            threats.append({
                                "count": count,
                                "direction": direction["name"],
                                "start_row": row,
                                "start_col": col,
                                "block_row": block_row,
                                "block_col": block_col,
                                "type": "sequence"
                            })
                        
                        # Sprawdź przeciwny koniec linii
                        block_row = row - direction["dr"]
                        block_col = col - direction["dc"]
                        
                        if 0 <= block_row < board_size and 0 <= block_col < board_size and board[block_row][block_col] is None:
                            threats.append({
                                "count": count,
                                "direction": direction["name"],
                                "start_row": row,
                                "start_col": col,
                                "block_row": block_row,
                                "block_col": block_col,
                                "type": "sequence"
                            })
    
    # 2. Sprawdź wzorce z przerwami (X_XX lub XX_X)
    for row in range(board_size):
        for col in range(board_size):
            if board[row][col] is None:  # Sprawdź tylko puste pola jako potencjalne przerwy
                for direction in directions:
                    # Sprawdź wzorzec X_XX (gdzie _ to aktualna pozycja)
                    prev_r = row - direction["dr"]
                    prev_c = col - direction["dc"]
                    next1_r = row + direction["dr"]
                    next1_c = col + direction["dc"]
                    next2_r = row + direction["dr"] * 2
                    next2_c = col + direction["dc"] * 2
                    
                    # Sprawdź, czy mamy X przed przerwą i XX po przerwie
                    if (0 <= prev_r < board_size and 0 <= prev_c < board_size and board[prev_r][prev_c] == player and
                        0 <= next1_r < board_size and 0 <= next1_c < board_size and board[next1_r][next1_c] == player and
                        0 <= next2_r < board_size and 0 <= next2_c < board_size and board[next2_r][next2_c] == player):
                        
                        threats.append({
                            "count": 3,  # 3 znaki z przerwą
                            "direction": direction["name"],
                            "start_row": prev_r,
                            "start_col": prev_c,
                            "block_row": row,
                            "block_col": col,
                            "type": "gap_pattern",
                            "pattern": "X_XX"
                        })
                    
                    # Sprawdź wzorzec XX_X (gdzie _ to aktualna pozycja)
                    prev2_r = row - direction["dr"] * 2
                    prev2_c = col - direction["dc"] * 2
                    
                    # Sprawdź, czy mamy XX przed przerwą i X po przerwie
                    if (0 <= prev2_r < board_size and 0 <= prev2_c < board_size and board[prev2_r][prev2_c] == player and
                        0 <= prev_r < board_size and 0 <= prev_c < board_size and board[prev_r][prev_c] == player and
                        0 <= next1_r < board_size and 0 <= next1_c < board_size and board[next1_r][next1_c] == player):
                        
                        threats.append({
                            "count": 3,  # 3 znaki z przerwą
                            "direction": direction["name"],
                            "start_row": prev2_r,
                            "start_col": prev2_c,
                            "block_row": row,
                            "block_col": col,
                            "type": "gap_pattern",
                            "pattern": "XX_X"
                        })
    
    # Sortuj zagrożenia - większa liczba znaków to większe zagrożenie
    threats.sort(key=lambda x: (x["count"], 0 if x["type"] == "sequence" else -1), reverse=True)
    
    return threats

# Funkcja do analizy planszy i dodania wskazówek strategicznych
def enhance_prompt_with_strategy(prompt):
    try:
        # Wyodrębnij stan planszy z promptu
        board_state_start = prompt.find("Stan planszy")
        if board_state_start == -1:
            return None
            
        lines = prompt[board_state_start:].split('\n')
        board = []
        row_index = 0
        
        # Przetwarzaj linie stanu planszy
        for i, line in enumerate(lines):
            if i < 2:  # Pomijamy nagłówek
                continue
                
            if "Dostępne ruchy" in line or "KRYTYCZNE ZAGROŻENIE" in line:  # Koniec planszy
                break
                
            # Usuń numery wierszy i pozostaw tylko stany komórek
            if " " in line:
                cells = line.split(" ")[1:]  # Pierwszy element to numer wiersza
                board.append([cell if cell != "." else None for cell in cells if cell])
                row_index += 1
        
        # Znajdź potencjalne zagrożenia i dobre ruchy
        threats = find_threats(board, "krzyżyk")
        opportunities = find_threats(board, "kółko")
        
        # Dodaj analizę strategiczną do promptu
        strategy_info = "\n\nANALIZA STRATEGICZNA:"
        
        if threats:
            strategy_info += "\nZAGROŻENIA (wymagają blokady):"
            for threat in threats[:3]:  # Ogranicz do top 3 zagrożeń
                if threat["type"] == "sequence":
                    strategy_info += f"\n- PRIORYTET! Przeciwnik ma {threat['count']} znaków w rzędzie w kierunku {threat['direction']} zaczynając od ({threat['start_row']},{threat['start_col']}). MUSISZ zablokować ruch na ({threat['block_row']},{threat['block_col']})."
                else:  # gap_pattern
                    strategy_info += f"\n- NIEBEZPIECZEŃSTWO! Przeciwnik ma wzorzec {threat['pattern']} w kierunku {threat['direction']} zaczynając od ({threat['start_row']},{threat['start_col']}). MUSISZ zablokować lukę na ({threat['block_row']},{threat['block_col']})."
        
        if opportunities:
            strategy_info += "\nMOŻLIWOŚCI (rozważ te ruchy):"
            for opp in opportunities[:3]:  # Ogranicz do top 3 możliwości
                if opp["type"] == "sequence":
                    strategy_info += f"\n- Masz {opp['count']} znaków w rzędzie w kierunku {opp['direction']} zaczynając od ({opp['start_row']},{opp['start_col']}). Rozważ kontynuowanie na ({opp['block_row']},{opp['block_col']})."
                else:  # gap_pattern
                    strategy_info += f"\n- Masz wzorzec {opp['pattern']} w kierunku {opp['direction']}. Możesz uzupełnić lukę na ({opp['block_row']},{opp['block_col']})."
        
        # Dodaj ogólną poradę z naciskiem na blokowanie zagrożeń
        strategy_info += "\nOGÓLNA STRATEGIA: NAJPIERW zablokuj wszelkie zagrożenia przeciwnika, POTEM twórz własne linie. Szukaj ruchów, które tworzą wiele zagrożeń jednocześnie."
        
        # Jeśli istnieje krytyczne zagrożenie (3+ w rzędzie), dodaj mocne ostrzeżenie
        critical_threats = [t for t in threats if t["count"] >= 3]
        if critical_threats:
            strategy_info += "\n\nUWAGA! KRYTYCZNE ZAGROŻENIE WYKRYTE! MUSISZ natychmiast zablokować pozycję na współrzędnych " + \
                            f"({critical_threats[0]['block_row']},{critical_threats[0]['block_col']}), " + \
                            "inaczej przegrasz w następnym ruchu!"
        
        return prompt + strategy_info
    except Exception as e:
        print(f"Błąd podczas analizy planszy: {e}", file=sys.stderr)
        return None

if __name__ == '__main__':
    port = int(os.getenv('PORT', 6000))
    app.run(host='0.0.0.0', port=port, debug=True)
