// Record di prova delle statistiche e delle domande all'archivio (dati inventati). Valori attesi ricavati a mano.
export const VUOTO = {
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', deleted: false,
  data: '', oraAllert: '', missione: '', pazienti: null, comune: '', mezzo: '', tipologia: '', codiceInvio: '',
  patologiaInvio: '', luogoInvio: '', eta: null, sesso: '', esito: '', ospedale: '', codiceRientro: '',
  patologiaRientro: '', luogoRientro: '', liberoOperativo: '',
};
export const r = (campi) => ({ ...VUOTO, ...campi });

export const RECORD = [
  r({ id: 'r1', data: '2026-01-10', oraAllert: '08:00', liberoOperativo: '09:00', missione: '04AA0001', mezzo: '3030', tipologia: 'Mike',
    codiceInvio: 'GIALLO', patologiaInvio: '02 - Cardio', luogoInvio: 'K - Casa', codiceRientro: 'ROSSO', patologiaRientro: '02 - Cardio',
    luogoRientro: 'K - Casa', esito: 'Trasportato', ospedale: 'Biella', eta: 70, sesso: 'Maschio' }),
  r({ id: 'r2', data: '2026-01-20', oraAllert: '23:30', liberoOperativo: '00:10', missione: '04AA0002', mezzo: '5022', tipologia: 'India',
    codiceInvio: 'ROSSO', patologiaInvio: '01 - Trauma', luogoInvio: 'S - Sierra', codiceRientro: 'NERO', patologiaRientro: '01 - Trauma',
    luogoRientro: 'S - Sierra', esito: 'Deceduto', eta: 85, sesso: 'Femmina' }),
  r({ id: 'r3', data: '2026-02-05', oraAllert: '10:00', liberoOperativo: '10:10', missione: '04AA0003', mezzo: '3030', tipologia: 'Mike',
    codiceInvio: 'VERDE', patologiaInvio: '01 - Trauma', luogoInvio: 'S - Sierra', esito: 'Annullato da CO', eta: 30, sesso: 'Maschio' }),
  r({ id: 'r4', data: '2027-01-03', oraAllert: '14:15', liberoOperativo: '15:00', missione: '04AA0004', mezzo: '3030', tipologia: 'Mike',
    codiceInvio: 'GIALLO', patologiaInvio: '03 - Respiro', luogoInvio: 'K - Casa', codiceRientro: 'VERDE', patologiaRientro: '03 - Respiro',
    luogoRientro: 'K - Casa', esito: 'Non Necessita', eta: 5, sesso: 'Femmina' }),
  r({ id: 'r5', oraAllert: '12:00', missione: '04AA0005', mezzo: '3040', tipologia: 'India', codiceInvio: 'GIALLO',
    patologiaInvio: '02 - Cardio', luogoInvio: 'Z - Altro', codiceRientro: 'GIALLO', patologiaRientro: '19 - Altro',
    luogoRientro: 'Z - Altro', esito: 'Rifiuto Trasporto', eta: 50, sesso: 'Maschio' }),
  r({ id: 'r6', deleted: true, data: '2026-01-15', missione: '04AA0006', codiceInvio: 'ROSSO', esito: 'Trasportato', ospedale: 'Novara', eta: 40 }),
  r({ id: 'r7', comune: 'BIELLA', esito: 'Trasportato' }),
];

// Un intervento con due pazienti: due schede della stessa missione, la prima con la spunta "Paziente multiplo".
export const MULTI = [
  ...RECORD,
  r({ id: 'm1', createdAt: '2026-03-01T10:00:00.000Z', data: '2026-03-01', oraAllert: '09:00', liberoOperativo: '10:00', missione: '99ZZ0101', pazienti: 2, mezzo: '3030', tipologia: 'Mike',
    codiceInvio: 'ROSSO', codiceRientro: 'GIALLO', esito: 'Trasportato', ospedale: 'Biella', eta: 20, sesso: 'Maschio' }),
  r({ id: 'm2', createdAt: '2026-03-01T10:05:00.000Z', data: '2026-03-01', oraAllert: '09:00', liberoOperativo: '10:00', missione: '99ZZ0101', pazienti: 2, mezzo: '3030', tipologia: 'Mike',
    codiceInvio: 'ROSSO', codiceRientro: 'ROSSO', esito: 'Trasportato', ospedale: 'Novara', eta: 60, sesso: 'Femmina' }),
];
