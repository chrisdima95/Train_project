import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent.parent / 'treni.db'


def get_connection():
  """Ritorna una connessione al database SQLite."""
  return sqlite3.connect(DB_PATH)


def has_column(conn: sqlite3.Connection, table: str, column: str) -> bool:
  """Ritorna True se la colonna esiste nella tabella."""
  cur = conn.cursor()
  cur.execute(f"PRAGMA table_info({table})")
  return any(info[1] == column for info in cur.fetchall())


def mostra_treno_live():
  """Stampa a schermo il record corrente di treno_live."""
  with get_connection() as conn:
    cur = conn.cursor()
    cur.execute('SELECT * FROM treno_live')
    rows = cur.fetchall()

  if not rows:
    print('Nessun record in treno_live.')
    return

  for row in rows:
    (
      id_treno,
      velocita,
      potenza_kw,
      energia_kwh,
      massa,
      tipo_alimentazione,
      altre_metriche,
    ) = row
    print('--- Stato treno live ---')
    print(f'ID: {id_treno}')
    print(f'Velocità: {velocita} km/h')
    print(f'Potenza: {potenza_kw} kW')
    print(f'Energia: {energia_kwh} kWh')
    print(f'Massa: {massa} t')
    print(f'Tipo alimentazione: {tipo_alimentazione}')
    print(f'Altre metriche: {altre_metriche}')


def mostra_storico():
  """Stampa l’intera tabella treno_history ordinata per orario."""
  with get_connection() as conn:
    cur = conn.cursor()
    include_tipo = has_column(conn, 'treno_history', 'tipo_alimentazione')
    if include_tipo:
      cur.execute(
        '''
        SELECT timestamp, velocita, potenza_kw, energia_kwh, massa, tipo_alimentazione
        FROM treno_history
        ORDER BY timestamp
        '''
      )
    else:
      cur.execute(
        '''
        SELECT timestamp, velocita, potenza_kw, energia_kwh, massa
        FROM treno_history
        ORDER BY timestamp
        '''
      )
    rows = cur.fetchall()

  if not rows:
    print('Nessun record in treno_history.')
    return

  print('--- Storico treno_history ---')
  for row in rows:
    if len(row) == 6:
      ts, v, p, e, m, tipo = row
    else:
      ts, v, p, e, m = row
      tipo = 'N/D'
    print(
      f'[{ts}] velocità={v} km/h, potenza={p} kW, '
      f'energia={e} kWh, massa={m} t, tipo_alimentazione={tipo}'
    )


def filtra_per_orario(orario: str):
  """Mostra il record di treno_history per un orario specifico (es. '08:40')."""
  with get_connection() as conn:
    cur = conn.cursor()
    include_tipo = has_column(conn, 'treno_history', 'tipo_alimentazione')
    if include_tipo:
      cur.execute(
        '''
        SELECT timestamp, velocita, potenza_kw, energia_kwh, massa, tipo_alimentazione
        FROM treno_history
        WHERE timestamp = ?
        ''',
        (orario,),
      )
    else:
      cur.execute(
        '''
        SELECT timestamp, velocita, potenza_kw, energia_kwh, massa
        FROM treno_history
        WHERE timestamp = ?
        ''',
        (orario,),
      )
    row = cur.fetchone()

  if not row:
    print(f"Nessun record trovato per l'orario {orario}.")
    return

  if len(row) == 6:
    ts, v, p, e, m, tipo = row
  else:
    ts, v, p, e, m = row
    tipo = 'N/D'

  print('--- Dettaglio per orario ---')
  print(f'Orario: {ts}')
  print(f'Velocità: {v} km/h')
  print(f'Potenza: {p} kW')
  print(f'Energia: {e} kWh')
  print(f'Massa: {m} t')
  print(f'Tipo alimentazione: {tipo}')


if __name__ == '__main__':
  print(f'Usando il database in: {DB_PATH}')
  print()
  mostra_treno_live()
  print()
  mostra_storico()


