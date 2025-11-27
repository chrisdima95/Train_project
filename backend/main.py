from flask import Flask, jsonify
from flask_cors import CORS
from database import init_db, fetch_live_data, fetch_history, calcola_consumo_30min

ROUTE_SEGMENTS = [
    {'citta': 'Torino', 'km': 0, 'lat': 45.0703, 'lon': 7.6869},
    {'citta': 'Milano', 'km': 140, 'lat': 45.4642, 'lon': 9.1899},
    {'citta': 'Bologna', 'km': 380, 'lat': 44.4949, 'lon': 11.3426},
    {'citta': 'Firenze', 'km': 500, 'lat': 43.7696, 'lon': 11.2558},
    {'citta': 'Roma', 'km': 650, 'lat': 41.9028, 'lon': 12.4964},
]

app = Flask(__name__)
CORS(app)


@app.get('/api/dati')
def dati_treno():
    data = fetch_live_data()
    if not data:
        return jsonify({'message': 'Nessun dato disponibile'}), 404
    # Aggiungi il consumo degli ultimi 30 minuti
    consumo_30min = calcola_consumo_30min()
    payload = data | {'timeline': fetch_history(), 'route': ROUTE_SEGMENTS, 'consumo_30min': consumo_30min}
    return jsonify(payload)


if __name__ == '__main__':
    init_db()
    print('Database pronto. Avvio server Flask su http://localhost:5000 ...')
    app.run(host='0.0.0.0', port=5000)