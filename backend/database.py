import sqlite3
from pathlib import Path

DB_PATH = Path('treni.db')

# Format: (timestamp, velocita, potenza_kw, energia_kwh, massa, tipo_alimentazione, stato_operativo, freni, motori, tensione_motori, corrente_trazione, pressione)
HISTORY_SAMPLES = [
    ('08:10', 0, 0, 100.0, 430.0, '25kV AC', 'In sosta', 'Attivi', 'Spenti', 0.0, 0.0, 8.5),
    ('08:20', 120, 3500, 320.0, 430.0, '25kV AC', 'In marcia', 'Rilasciati', 'Attivi', 25000.0, 140.0, 8.5),
    ('08:30', 220, 4800, 640.0, 430.0, '25kV AC', 'In marcia', 'Rilasciati', 'Attivi', 24800.0, 193.0, 8.5),
    ('08:40', 245, 5200, 920.0, 430.0, '25kV AC', 'In marcia', 'Rilasciati', 'Attivi', 24500.0, 212.0, 8.5),
    ('08:50', 210, 4700, 1180.0, 430.0, '3kV DC', 'In marcia', 'Rilasciati', 'Attivi', 3000.0, 1566.0, 8.5),
    ('09:00', 160, 3600, 1405.0, 430.0, '3kV DC', 'In marcia', 'Rilasciati', 'Attivi', 2950.0, 1220.0, 8.5),
    ('09:10', 80, 2200, 1580.0, 430.0, '3kV DC', 'Frenatura', 'Attivi', 'Rigenerazione', 3100.0, -710.0, 7.2),
    ('09:20', 30, 900, 1705.0, 430.0, '1.5kV DC', 'Frenatura', 'Attivi', 'Rigenerazione', 1550.0, -580.0, 6.5),
]


def init_db():
    """Crea il file SQLite, il record live e lo storico simulato."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('DROP TABLE IF EXISTS treno_live')
    cursor.execute(
        '''
        CREATE TABLE treno_live (
            id TEXT PRIMARY KEY,
            velocita INTEGER,
            potenza_kw REAL,
            energia_kwh REAL,
            massa REAL,
            tipo_alimentazione TEXT,
            stato_operativo TEXT,
            freni TEXT,
            motori TEXT,
            tensione_motori REAL,
            corrente_trazione REAL,
            pressione REAL,
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
            tipo_alimentazione TEXT,
            stato_operativo TEXT,
            freni TEXT,
            motori TEXT,
            tensione_motori REAL,
            corrente_trazione REAL,
            pressione REAL
        )
        '''
    )
    cursor.execute(
        '''
        INSERT OR REPLACE INTO treno_live
        (id, velocita, potenza_kw, energia_kwh, massa, tipo_alimentazione, stato_operativo, freni, motori, tensione_motori, corrente_trazione, pressione, altre_metriche)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''',
        (
            'ETR-1000',
            245,
            5200.0,
            1850.5,
            430.0,
            '25kV AC',
            'In marcia',
            'Rilasciati',
            'Attivi',
            24500.0,
            212.0,
            8.5,
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
            tipo_alimentazione,
            stato_operativo,
            freni,
            motori,
            tensione_motori,
            corrente_trazione,
            pressione
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        'stato_operativo',
        'freni',
        'motori',
        'tensione_motori',
        'corrente_trazione',
        'pressione',
        'altre_metriche',
    ]
    return dict(zip(keys, row))


def fetch_history():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute(
        '''
        SELECT timestamp, velocita, potenza_kw, energia_kwh, massa, tipo_alimentazione, stato_operativo, freni, motori, tensione_motori, corrente_trazione, pressione
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
            'stato_operativo': stato_operativo,
            'freni': freni,
            'motori': motori,
            'tensione_motori': tensione_motori,
            'corrente_trazione': corrente_trazione,
            'pressione': pressione,
        }
        for (
            timestamp,
            velocita,
            potenza_kw,
            energia_kwh,
            massa,
            tipo_alimentazione,
            stato_operativo,
            freni,
            motori,
            tensione_motori,
            corrente_trazione,
            pressione,
        ) in rows
    ]


def calcola_consumo_30min():
    """Calcola il consumo di energia negli ultimi 30 minuti."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Prendi l'energia attuale
    cursor.execute('SELECT energia_kwh FROM treno_live WHERE id = "ETR-1000"')
    row = cursor.fetchone()
    energia_attuale = row[0] if row else 0
    
    # Prendi l'energia di 30 minuti fa (assumiamo che ogni record sia a 10 minuti di distanza)
    # Quindi prendiamo il terzo record più vecchio (30 minuti fa)
    cursor.execute('''
        SELECT energia_kwh FROM treno_history 
        ORDER BY timestamp 
        LIMIT 1 OFFSET (SELECT MAX(0, COUNT(*) - 3) FROM treno_history)
    ''')
    row = cursor.fetchone()
    energia_30min_fa = row[0] if row else energia_attuale
    
    conn.close()
    
    # Calcola la differenza
    consumo = max(0, energia_attuale - energia_30min_fa)
    return round(consumo, 1)

