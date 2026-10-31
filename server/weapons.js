// Weapon definitions and configurations
export const WEAPON_TYPES = {
  ROCKET: 'ROCKET',
  BOMB: 'BOMB',
  GATLING: 'GATLING',
  BOOST: 'BOOST',
  MINE: 'MINE'
};

export const WEAPON_CONFIGS = {
  [WEAPON_TYPES.ROCKET]: {
    name: 'Homing Missile',
    icon: '🚀',
    damage: 45,
    speed: 28,
    lifetime: 4.5,
    radius: 0.6,
    explosionRadius: 4.2,
    cooldown: 1.0,
    ammo: 1,
    homingCone: 0.65,
    homingTurnRate: 2.6
  },
  [WEAPON_TYPES.BOMB]: {
    name: 'Bouncing Bomb',
    icon: '💣',
    damage: 55,
    speed: 18,
    lifetime: 3.5,
    radius: 0.8,
    explosionRadius: 5.0,
    cooldown: 0.8,
    ammo: 1,
    bounces: 3
  },
  [WEAPON_TYPES.GATLING]: {
    name: 'Laser Gatling',
    icon: '⚡',
    damage: 8,
    speed: 42,
    lifetime: 1.8,
    radius: 0.35,
    explosionRadius: 1.2,
    cooldown: 0.12,
    ammo: 15,
    spread: 0.04
  },
  [WEAPON_TYPES.BOOST]: {
    name: 'Nitro Jet Boost',
    icon: '🔥',
    damage: 80,
    speedBoost: 1.6,
    duration: 3.8,
    cooldown: 0.5,
    ammo: 1
  },
  [WEAPON_TYPES.MINE]: {
    name: 'Spiked Mine',
    icon: '💥',
    damage: 60,
    lifetime: 35.0,
    radius: 1.1,
    armDelay: 0.7,
    explosionRadius: 5.0,
    cooldown: 0.6,
    ammo: 3
  }
};

export function getRandomWeapon() {
  const pool = [
    WEAPON_TYPES.ROCKET,
    WEAPON_TYPES.ROCKET,
    WEAPON_TYPES.BOMB,
    WEAPON_TYPES.GATLING,
    WEAPON_TYPES.BOOST,
    WEAPON_TYPES.MINE
  ];
  return pool[Math.floor(Math.random() * pool.length)];
}
