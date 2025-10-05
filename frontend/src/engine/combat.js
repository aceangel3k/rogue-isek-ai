/**
 * Combat System for AI Dungeon Crawler
 * 
 * Features:
 * - Raycast shooting
 * - Hit detection
 * - Damage application
 * - Player damage feedback
 */

/**
 * Check if there's a wall between two points using DDA
 */
function hasWallBetween(x1, y1, x2, y2, mapData, mapSize) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const distance = Math.sqrt(dx * dx + dy * dy);
  
  if (distance < 0.01) return false;
  
  const rayDirX = dx / distance;
  const rayDirY = dy / distance;
  
  let mapX = Math.floor(x1);
  let mapY = Math.floor(y1);
  
  const deltaDistX = Math.abs(1 / rayDirX);
  const deltaDistY = Math.abs(1 / rayDirY);
  
  let stepX, stepY;
  let sideDistX, sideDistY;
  
  if (rayDirX < 0) {
    stepX = -1;
    sideDistX = (x1 - mapX) * deltaDistX;
  } else {
    stepX = 1;
    sideDistX = (mapX + 1 - x1) * deltaDistX;
  }
  
  if (rayDirY < 0) {
    stepY = -1;
    sideDistY = (y1 - mapY) * deltaDistY;
  } else {
    stepY = 1;
    sideDistY = (mapY + 1 - y1) * deltaDistY;
  }
  
  // DDA algorithm
  let currentDist = 0;
  for (let i = 0; i < 64; i++) {
    if (sideDistX < sideDistY) {
      sideDistX += deltaDistX;
      mapX += stepX;
      currentDist = sideDistX - deltaDistX;
    } else {
      sideDistY += deltaDistY;
      mapY += stepY;
      currentDist = sideDistY - deltaDistY;
    }
    
    // Stop if we've gone past the target
    if (currentDist >= distance) {
      return false;
    }
    
    // Check if out of bounds
    if (mapX < 0 || mapX >= mapSize || mapY < 0 || mapY >= mapSize) {
      return true;
    }
    
    // Check if hit a wall
    if (mapData[mapY * mapSize + mapX] > 0) {
      return true;
    }
  }
  
  return false;
}

/**
 * Perform a raycast to detect what the player is aiming at
 * Returns the first enemy hit, or null if no hit
 * Now includes wall collision detection
 */
export function raycastShoot(playerX, playerY, dirX, dirY, enemies, maxDistance = 20, mapData = null, mapSize = 0) {
  let closestEnemy = null;
  let closestDistance = maxDistance;
  
  // Check each enemy
  for (const enemy of enemies) {
    if (!enemy.isAlive()) continue;
    
    // Vector from player to enemy
    const dx = enemy.x - playerX;
    const dy = enemy.y - playerY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance > maxDistance) continue;
    
    // Check if there's a wall between player and enemy
    if (mapData && mapSize > 0) {
      if (hasWallBetween(playerX, playerY, enemy.x, enemy.y, mapData, mapSize)) {
        continue; // Can't shoot through walls
      }
    }
    
    // Normalize
    const ndx = dx / distance;
    const ndy = dy / distance;
    
    // Check if enemy is in front of player (dot product)
    const dot = dirX * ndx + dirY * ndy;
    
    // Enemy must be in front (dot > 0.9 means within ~25 degrees)
    if (dot > 0.9) {
      // Calculate perpendicular distance to ray
      // This determines if the enemy is close enough to the aim line
      const perpDist = Math.abs(dx * dirY - dy * dirX);
      
      // Hit radius (0.5 = half a tile)
      if (perpDist < 0.5 && distance < closestDistance) {
        closestEnemy = enemy;
        closestDistance = distance;
      }
    }
  }
  
  return {
    hit: closestEnemy !== null,
    enemy: closestEnemy,
    distance: closestDistance
  };
}

/**
 * Apply damage to an enemy
 * Returns true if enemy died
 */
export function damageEnemy(enemy, damage) {
  if (!enemy || !enemy.isAlive()) {
    return false;
  }
  
  const died = enemy.takeDamage(damage);
  return died;
}

/**
 * Calculate player damage with visual feedback data
 */
export function calculatePlayerDamage(currentHealth, damage, maxHealth = 100) {
  const newHealth = Math.max(0, currentHealth - damage);
  const healthPercent = (newHealth / maxHealth) * 100;
  
  return {
    newHealth: newHealth,
    healthPercent: healthPercent,
    isDead: newHealth <= 0,
    damageAmount: damage,
    severity: damage > 30 ? 'high' : damage > 15 ? 'medium' : 'low'
  };
}

/**
 * Get crosshair color based on what player is aiming at
 */
export function getCrosshairState(playerX, playerY, dirX, dirY, enemies, mapData = null, mapSize = 0) {
  const result = raycastShoot(playerX, playerY, dirX, dirY, enemies, 15, mapData, mapSize);
  
  return {
    isAimingAtEnemy: result.hit,
    enemy: result.enemy,
    distance: result.distance,
    color: result.hit ? '#ff0000' : '#ffffff'
  };
}

/**
 * Weapon stats
 */
export const WEAPONS = {
  pistol: {
    name: 'Pistol',
    damage: 25,
    fireRate: 500, // ms between shots
    range: 20
  },
  shotgun: {
    name: 'Shotgun',
    damage: 50,
    fireRate: 1000,
    range: 10
  },
  rifle: {
    name: 'Rifle',
    damage: 35,
    fireRate: 300,
    range: 25
  }
};

/**
 * Combat manager to track shooting cooldown
 */
export class CombatManager {
  constructor(weapon = 'pistol') {
    this.weapon = weapon;
    this.lastShotTime = 0;
    this.kills = 0;
  }
  
  /**
   * Attempt to shoot
   * Returns true if shot was fired
   */
  shoot(playerX, playerY, dirX, dirY, enemies, mapData = null, mapSize = 0) {
    const now = Date.now();
    const weaponStats = WEAPONS[this.weapon];
    
    // Check fire rate cooldown
    if (now - this.lastShotTime < weaponStats.fireRate) {
      return {
        fired: false,
        reason: 'cooldown'
      };
    }
    
    // Perform raycast with wall collision
    const result = raycastShoot(playerX, playerY, dirX, dirY, enemies, weaponStats.range, mapData, mapSize);
    
    if (result.hit) {
      // Apply damage
      const died = damageEnemy(result.enemy, weaponStats.damage);
      
      if (died) {
        this.kills++;
      }
      
      this.lastShotTime = now;
      
      return {
        fired: true,
        hit: true,
        enemy: result.enemy,
        died: died,
        damage: weaponStats.damage,
        distance: result.distance
      };
    } else {
      // Missed shot
      this.lastShotTime = now;
      
      return {
        fired: true,
        hit: false
      };
    }
  }
  
  /**
   * Change weapon
   */
  setWeapon(weaponName) {
    if (WEAPONS[weaponName]) {
      this.weapon = weaponName;
      return true;
    }
    return false;
  }
  
  /**
   * Get current weapon stats
   */
  getWeaponStats() {
    return WEAPONS[this.weapon];
  }
  
  /**
   * Check if can shoot (not on cooldown)
   */
  canShoot() {
    const now = Date.now();
    const weaponStats = WEAPONS[this.weapon];
    return (now - this.lastShotTime) >= weaponStats.fireRate;
  }
  
  /**
   * Get cooldown progress (0-1)
   */
  getCooldownProgress() {
    const now = Date.now();
    const weaponStats = WEAPONS[this.weapon];
    const elapsed = now - this.lastShotTime;
    return Math.min(1, elapsed / weaponStats.fireRate);
  }
}
