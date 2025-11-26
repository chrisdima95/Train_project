import sqlite3
from pathlib import Path

from flask import Flask, jsonify
from flask_cors import CORS

DB_PATH = Path('treni.db')
ROUTE_SEGMENTS = [
    {'citta': 'Torino', 'km': 0, 'lat': 45.0703, 'lon': 7.6869},
    {'citta': 'Milano', 'km': 140, 'lat': 45.4642, 'lon': 9.1899},
    {'citta': 'Bologna', 'km': 380, 'lat': 44.4949, 'lon': 11.3426},
    {'citta': 'Firenze', 'km': 500, 'lat': 43.7696, 'lon': 11.2558},
    {'citta': 'Roma', 'km': 650, 'lat': 41.9028, 'lon': 12.4964},
]
HISTORY_SAMPLES = [
    ('08:10', 0, 0, 100.0, 430.0, '25kV AC'),
    ('08:20', 120, 3500, 320.0, 430.0, '25kV AC'),
    ('08:30', 220, 4800, 640.0, 430.0, '25kV AC'),
    ('08:40', 245, 5200, 920.0, 430.0, '25kV AC'),
    ('08:50', 210, 4700, 1180.0, 430.0, '3kV DC'),
    ('09:00', 160, 3600, 1405.0, 430.0, '3kV DC'),
    ('09:10', 80, 2200, 1580.0, 430.0, '3kV DC'),
    ('09:20', 30, 900, 1705.0, 430.0, '1.5kV DC'),
]


def init_db():
    """Crea il file SQLite, il record live e lo storico simulato."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute(
        '''
        CREATE TABLE IF NOT EXISTS treno_live (
            id TEXT PRIMARY KEY,
            velocita INTEGER,
            potenza_kw REAL,
            energia_kwh REAL,
            massa REAL,
            tipo_alimentazione TEXT,
            altre_metriche TEXT
        )
        '''
    )
    cursor.execute('DROP TABLE IF EXISTS treno_history')
    cursor.execute(
        '''
        CREATE TABLE treno_history (
            timestamp TEXT PRIMARY KEY,
            velocita INTEGER,
            potenza_kw REAL,
            energia_kwh REAL,
            massa REAL,
            tipo_alimentazione TEXT
        )
        '''
    )
    cursor.execute(
        '''
        INSERT OR REPLACE INTO treno_live
        (id, velocita, potenza_kw, energia_kwh, massa, tipo_alimentazione, altre_metriche)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ''',
        (
            'ETR-1000',
            245,
            5200.0,
            1850.5,
            430.0,
            '25kV AC',
            'temperatura_freni=65C;pressione_linea=8bar',
        ),
    )
    cursor.executemany(
        '''
        INSERT OR REPLACE INTO treno_history
        (
            timestamp,
            velocita,
            potenza_kw,
            energia_kwh,
            massa,
            tipo_alimentazione
        )
        VALUES (?, ?, ?, ?, ?, ?)
        ''',
        HISTORY_SAMPLES,
    )
    conn.commit()
    conn.close()


def fetch_live_data():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM treno_live LIMIT 1')
    row = cursor.fetchone()
    conn.close()
    if not row:
        return None

    keys = [
        'id',
        'velocita',
        'potenza_kw',
        'energia_kwh',
        'massa',
        'tipo_alimentazione',
        'altre_metriche',
    ]
    return dict(zip(keys, row))


def fetch_history():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute(
        '''
        SELECT timestamp, velocita, potenza_kw, energia_kwh, massa, tipo_alimentazione
        FROM treno_history
        ORDER BY timestamp
        '''
    )
    rows = cursor.fetchall()
    conn.close()
    return [
        {
            'timestamp': timestamp,
            'velocita': velocita,
            'potenza_kw': potenza_kw,
            'energia_kwh': energia_kwh,
            'massa': massa,
            'tipo_alimentazione': tipo_alimentazione,
        }
        for (
            timestamp,
            velocita,
            potenza_kw,
            energia_kwh,
            massa,
            tipo_alimentazione,
        ) in rows
    ]


app = Flask(__name__)
CORS(app)


@app.get('/api/dati')
def dati_treno():
    data = fetch_live_data()
    if not data:
        return jsonify({'message': 'Nessun dato disponibile'}), 404
    payload = data | {'timeline': fetch_history(), 'route': ROUTE_SEGMENTS}
    return jsonify(payload)


if __name__ == '__main__':
    init_db()
    print('Database pronto. Avvio server Flask su http://localhost:5000 ...')
    app.run(host='0.0.0.0', port=5000)