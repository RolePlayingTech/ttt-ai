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
        
        # Użycie funkcji z ai_client.py do pobrania odpowiedzi od AI
        commentary = get_ai_response(prompt)
        
        # Sprawdzenie, czy odpowiedź zawiera informację o błędzie
        if commentary.startswith("Błąd:"):
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
            
            # Usuń marker ruchu z komentarza
            commentary = commentary[:commentary.find(move_marker)].strip()
        
        return jsonify({
            'commentary': commentary,
            'ai_move': ai_move
        })
    except Exception as e:
        error_details = f"Błąd podczas przetwarzania zapytania AI: {str(e)}"
        print(error_details, file=sys.stderr)
        return jsonify({'error': error_details}), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
