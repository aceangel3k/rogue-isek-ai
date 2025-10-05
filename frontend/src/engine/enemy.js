/**
 * Enemy AI System for AI Dungeon Crawler
 * 
 * Features:
 * - State machine (idle, chase, attack, dead)
 * - Line-of-sight detection
 * - Simple chase AI
 * - Melee attack system
 */

// Enemy states
export const EnemyState = {
  IDLE: 'idle',
  CHASE: 'chase',
  ATTACK: 'attack',
  DEAD: 'dead'
};

export class Enemy {
  constructor(id, x, y, type, stats) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.type = type;
    
    // Stats from AI generation
    this.maxHealth = stats.health || 50;
    this.health = this.maxHealth;
    this.damage = stats.damage || 10;
    this.speed = stats.speed || .3; // tiles per second (player is 3.0, so enemies are 1/6th speed)
    this.detectionRange = stats.detectionRange || 8;
    this.attackRange = stats.attackRange || 1.5;
    this.attackCooldown = stats.attackCooldown || 1000; // ms
    
    // State
    this.state = EnemyState.IDLE;
    this.lastAttackTime = 0;
    this.targetX = x;
    this.targetY = y;
    
    // Patrol behavior
    this.patrolTimer = 0;
    this.patrolDirection = Math.random() * Math.PI * 2;
    this.patrolChangeInterval = 2000 + Math.random() * 2000; // 2-4 seconds
    
    // Pathfinding
    this.path = [];
    this.pathUpdateTimer = 0;
    this.pathUpdateInterval = 500; // Update path every 500ms
    
    // Animation
    this.direction = 0; // 0=front, 1=back, 2=left, 3=right
    this.animationFrame = 0;
  }
  
  /**
   * Update enemy AI logic
   */
  update(playerX, playerY, mapData, mapSize, deltaTime) {
    if (this.state === EnemyState.DEAD) {
      return;
    }
    
    const distanceToPlayer = this.getDistance(playerX, playerY);
    
    // State transitions
    switch (this.state) {
      case EnemyState.IDLE:
        // Check for player detection
        if (distanceToPlayer < this.detectionRange && this.hasLineOfSight(playerX, playerY, mapData, mapSize)) {
          this.state = EnemyState.CHASE;
        } else {
          // Patrol behavior when idle
          this.patrol(mapData, mapSize, deltaTime);
        }
        break;
        
      case EnemyState.CHASE:
        if (distanceToPlayer > this.detectionRange * 1.5) {
          // Lost player
          this.state = EnemyState.IDLE;
        } else if (distanceToPlayer < this.attackRange) {
          // In attack range
          this.state = EnemyState.ATTACK;
        } else if (this.hasLineOfSight(playerX, playerY, mapData, mapSize)) {
          // Chase player
          this.chasePlayer(playerX, playerY, mapData, mapSize, deltaTime);
        }
        break;
        
      case EnemyState.ATTACK:
        if (distanceToPlayer > this.attackRange * 1.2) {
          // Player moved away
          this.state = EnemyState.CHASE;
        } else {
          // Face player and attack
          this.facePlayer(playerX, playerY);
          this.tryAttack();
        }
        break;
    }
  }
  
  /**
   * Patrol behavior - wander randomly when idle
   */
  patrol(mapData, mapSize, deltaTime) {
    // deltaTime is in seconds
    this.patrolTimer += (deltaTime * 1000) || 16;
    
    // Change direction periodically
    if (this.patrolTimer >= this.patrolChangeInterval) {
      this.patrolTimer = 0;
      this.patrolDirection = Math.random() * Math.PI * 2;
      this.patrolChangeInterval = 2000 + Math.random() * 2000;
    }
    
    // Move slowly in patrol direction
    const patrolSpeed = this.speed * 0.3; // 30% of chase speed
    const moveSpeed = patrolSpeed * deltaTime;
    
    const dirX = Math.cos(this.patrolDirection);
    const dirY = Math.sin(this.patrolDirection);
    
    const newX = this.x + dirX * moveSpeed;
    const newY = this.y + dirY * moveSpeed;
    
    // Check collision before moving
    if (this.isValidPosition(newX, newY, mapData, mapSize)) {
      this.x = newX;
      this.y = newY;
      this.updateDirection(dirX, dirY);
    } else {
      // Hit a wall, change direction
      this.patrolDirection = Math.random() * Math.PI * 2;
      this.patrolTimer = 0;
    }
  }
  
  /**
   * A* Pathfinding to find path to player
   */
  findPath(targetX, targetY, mapData, mapSize) {
    const startX = Math.floor(this.x);
    const startY = Math.floor(this.y);
    const endX = Math.floor(targetX);
    const endY = Math.floor(targetY);
    
    // Simple A* implementation
    const openSet = [{ x: startX, y: startY, g: 0, h: 0, f: 0, parent: null }];
    const closedSet = new Set();
    
    while (openSet.length > 0) {
      // Find node with lowest f score
      openSet.sort((a, b) => a.f - b.f);
      const current = openSet.shift();
      
      // Check if we reached the goal
      if (current.x === endX && current.y === endY) {
        // Reconstruct path
        const path = [];
        let node = current;
        while (node.parent) {
          path.unshift({ x: node.x + 0.5, y: node.y + 0.5 });
          node = node.parent;
        }
        return path;
      }
      
      closedSet.add(`${current.x},${current.y}`);
      
      // Check neighbors (4 directions)
      const neighbors = [
        { x: current.x + 1, y: current.y },
        { x: current.x - 1, y: current.y },
        { x: current.x, y: current.y + 1 },
        { x: current.x, y: current.y - 1 }
      ];
      
      for (const neighbor of neighbors) {
        // Skip if out of bounds or in closed set
        if (neighbor.x < 0 || neighbor.x >= mapSize || neighbor.y < 0 || neighbor.y >= mapSize) continue;
        if (closedSet.has(`${neighbor.x},${neighbor.y}`)) continue;
        
        // Skip if wall
        if (mapData[neighbor.y * mapSize + neighbor.x] !== 0) continue;
        
        const g = current.g + 1;
        const h = Math.abs(neighbor.x - endX) + Math.abs(neighbor.y - endY);
        const f = g + h;
        
        // Check if this neighbor is already in open set with better score
        const existing = openSet.find(n => n.x === neighbor.x && n.y === neighbor.y);
        if (existing && existing.g <= g) continue;
        
        openSet.push({
          x: neighbor.x,
          y: neighbor.y,
          g: g,
          h: h,
          f: f,
          parent: current
        });
      }
      
      // Limit iterations to prevent lag
      if (closedSet.size > 200) break;
    }
    
    return []; // No path found
  }
  
  /**
   * Chase the player using pathfinding
   */
  chasePlayer(playerX, playerY, mapData, mapSize, deltaTime) {
    // deltaTime is in seconds
    // Update path periodically
    this.pathUpdateTimer += (deltaTime * 1000) || 16;
    if (this.pathUpdateTimer >= this.pathUpdateInterval || this.path.length === 0) {
      this.pathUpdateTimer = 0;
      this.path = this.findPath(playerX, playerY, mapData, mapSize);
    }
    
    // Follow path if available
    if (this.path.length > 0) {
      const target = this.path[0];
      const dx = target.x - this.x;
      const dy = target.y - this.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      // If close to waypoint, move to next one
      if (distance < 0.3) {
        this.path.shift();
        if (this.path.length === 0) return;
        return this.chasePlayer(playerX, playerY, mapData, mapSize, deltaTime);
      }
      
      // Move toward current waypoint
      const dirX = dx / distance;
      const dirY = dy / distance;
      
      const moveSpeed = this.speed * deltaTime;
      
      // Debug logging (remove after testing)
      if (Math.random() < 0.01) {
        console.log(`Enemy ${this.id}: speed=${this.speed}, dt=${deltaTime.toFixed(4)}, moveSpeed=${moveSpeed.toFixed(4)}`);
      }
      
      const newX = this.x + dirX * moveSpeed;
      const newY = this.y + dirY * moveSpeed;
      
      if (this.isValidPosition(newX, newY, mapData, mapSize)) {
        this.x = newX;
        this.y = newY;
        this.updateDirection(dirX, dirY);
      }
    }
  }
  
  /**
   * Update sprite direction based on movement
   */
  updateDirection(dx, dy) {
    // Determine which direction is dominant
    if (Math.abs(dx) > Math.abs(dy)) {
      this.direction = dx > 0 ? 3 : 2; // right : left
    } else {
      this.direction = dy > 0 ? 0 : 1; // front : back
    }
  }
  
  /**
   * Face the player
   */
  facePlayer(playerX, playerY) {
    const dx = playerX - this.x;
    const dy = playerY - this.y;
    this.updateDirection(dx, dy);
  }
  
  /**
   * Try to attack the player
   */
  tryAttack() {
    const now = Date.now();
    if (now - this.lastAttackTime >= this.attackCooldown) {
      this.lastAttackTime = now;
      return this.damage;
    }
    return 0;
  }
  
  /**
   * Check if position is valid (not in wall)
   */
  isValidPosition(x, y, mapData, mapSize) {
    const mapX = Math.floor(x);
    const mapY = Math.floor(y);
    
    // Check boundaries
    if (mapX < 0 || mapX >= mapSize || mapY < 0 || mapY >= mapSize) {
      return false;
    }
    
    // Check if position is in a wall
    const mapIndex = mapY * mapSize + mapX;
    return mapData[mapIndex] === 0; // 0 means empty space
  }
  
  /**
   * Calculate distance to a point
   */
  getDistance(x, y) {
    const dx = x - this.x;
    const dy = y - this.y;
    return Math.sqrt(dx * dx + dy * dy);
  }
  
  /**
   * Check if enemy has line of sight to target
   * Uses DDA algorithm (similar to raycasting)
   */
  hasLineOfSight(targetX, targetY, mapData, mapSize) {
    const dx = targetX - this.x;
    const dy = targetY - this.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // Normalize direction
    const dirX = dx / distance;
    const dirY = dy / distance;
    
    // Step along the ray
    const steps = Math.ceil(distance * 2);
    for (let i = 0; i < steps; i++) {
      const checkX = this.x + dirX * (i * 0.5);
      const checkY = this.y + dirY * (i * 0.5);
      
      const mapX = Math.floor(checkX);
      const mapY = Math.floor(checkY);
      
      // Check boundaries
      if (mapX < 0 || mapX >= mapSize || mapY < 0 || mapY >= mapSize) {
        return false;
      }
      
      // Check if ray hit a wall
      const mapIndex = mapY * mapSize + mapX;
      if (mapData[mapIndex] !== 0) {
        return false; // Wall blocking line of sight
      }
    }
    
    return true; // Clear line of sight
  }
  
  /**
   * Take damage
   */
  takeDamage(amount) {
    if (this.state === EnemyState.DEAD) {
      return false;
    }
    
    this.health -= amount;
    
    if (this.health <= 0) {
      this.health = 0;
      this.state = EnemyState.DEAD;
      return true; // Enemy died
    }
    
    // Aggro on damage
    if (this.state === EnemyState.IDLE) {
      this.state = EnemyState.CHASE;
    }
    
    return false;
  }
  
  /**
   * Check if enemy is alive
   */
  isAlive() {
    return this.state !== EnemyState.DEAD;
  }
}

/**
 * Enemy Manager - handles all enemies in the game
 */
export class EnemyManager {
  constructor() {
    this.enemies = [];
    this.nextId = 0;
  }
  
  /**
   * Clear all enemies
   */
  clear() {
    this.enemies = [];
  }
  
  /**
   * Spawn enemies in the dungeon
   */
  spawnEnemies(spawnPositions, enemyTypes) {
    this.enemies = [];
    
    spawnPositions.forEach((pos, index) => {
      // Select enemy type (cycle through available types)
      const typeIndex = index % enemyTypes.length;
      const enemyType = enemyTypes[typeIndex];
      
      const enemy = new Enemy(
        this.nextId++,
        pos.x + 0.5, // Center in tile
        pos.y + 0.5,
        enemyType.id,
        {
          health: enemyType.health || 50,
          damage: enemyType.damage || 10,
          speed: enemyType.speed * 10 || .3, // Always use 1.5 tiles/sec (50% of player speed) - ignore AI values
          detectionRange: enemyType.detectionRange || 8,
          attackRange: enemyType.attackRange || 1.5,
          attackCooldown: enemyType.attackCooldown || 1000
        }
      );
      
      this.enemies.push(enemy);
    });
    
    console.log(`Spawned ${this.enemies.length} enemies`);
  }
  
  /**
   * Update all enemies
   */
  update(playerX, playerY, mapData, mapSize, deltaTime) {
    let totalDamage = 0;
    
    this.enemies.forEach(enemy => {
      if (enemy.isAlive()) {
        enemy.update(playerX, playerY, mapData, mapSize, deltaTime);
        
        // Check if enemy attacked
        if (enemy.state === EnemyState.ATTACK) {
          const damage = enemy.tryAttack();
          totalDamage += damage;
        }
      }
    });
    
    return totalDamage;
  }
  
  /**
   * Get all alive enemies
   */
  getAliveEnemies() {
    return this.enemies.filter(e => e.isAlive());
  }
  
  /**
   * Get enemy at position (for shooting)
   */
  getEnemyAtPosition(x, y, tolerance = 0.5) {
    return this.enemies.find(enemy => {
      if (!enemy.isAlive()) return false;
      const distance = enemy.getDistance(x, y);
      return distance < tolerance;
    });
  }
  
  /**
   * Remove dead enemies
   */
  removeDeadEnemies() {
    this.enemies = this.enemies.filter(e => e.isAlive());
  }
  
  /**
   * Get all enemies for rendering
   */
  getAllEnemies() {
    return this.enemies;
  }
  
  /**
   * Check if all enemies are dead
   */
  allEnemiesDead() {
    return this.enemies.every(e => !e.isAlive());
  }
}
