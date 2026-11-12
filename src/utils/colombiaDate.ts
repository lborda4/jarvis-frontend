/** Fecha calendario de Colombia, independiente de la zona horaria del equipo. */
export function getColombiaToday(now = new Date()): string {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now)
}
