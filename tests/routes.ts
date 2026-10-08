export const door = ['begin', 'door-inspect', 'door-controls', 'equalize', 'door-open'];
export const valve = ['valve-inspect', 'valve-equipment', 'valve-heat', 'valve-turn', 'to-power'];
export const power = ['power-inspect', 'power-controls', 'power-stop', 'leave'];
export const expert = [...door, ...valve, ...power];
export const hinted = ['begin', 'door-hint-door', 'door-hint-door', 'door-hint-door-cause', 'equalize', 'door-open', 'valve-hint-valve', 'valve-hint-valve', 'valve-hint-valve-cause', 'valve-heat', 'valve-turn', 'to-power', 'power-hint-power', 'power-hint-power', 'power-hint-power-cause', 'power-order', 'leave'];
export const mistaken = [...door.slice(0, -2), 'door-force', ...door.slice(-2), ...valve.slice(0, 2), 'valve-force', ...valve.slice(2), ...power.slice(0, 2), 'power-retry', ...power.slice(2)];
