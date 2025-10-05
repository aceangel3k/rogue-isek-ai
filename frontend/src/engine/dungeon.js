/**
 * Procedural Dungeon Generation using Binary Space Partitioning (BSP)
 * 
 * This module generates random dungeons by:
 * 1. Recursively splitting the space into rooms using BSP
 * 2. Creating rooms within each leaf node
 * 3. Connecting rooms with corridors
 * 4. Placing player start and exit portal
 */

class Room {
  constructor(x, y, width, height) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.centerX = Math.floor(x + width / 2);
    this.centerY = Math.floor(y + height / 2);
  }
}

class BSPNode {
  constructor(x, y, width, height) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.leftChild = null;
    this.rightChild = null;
    this.room = null;
  }

  split(minRoomSize) {
    // Don't split if already split
    if (this.leftChild !== null || this.rightChild !== null) {
      return false;
    }

    // Determine split direction based on aspect ratio
    const splitHorizontally = Math.random() > 0.5;

    // Calculate max split position
    const max = (splitHorizontally ? this.height : this.width) - minRoomSize;
    
    if (max <= minRoomSize) {
      return false; // Too small to split
    }

    // Choose split position
    const split = Math.floor(Math.random() * (max - minRoomSize)) + minRoomSize;

    // Create child nodes
    if (splitHorizontally) {
      this.leftChild = new BSPNode(this.x, this.y, this.width, split);
      this.rightChild = new BSPNode(this.x, this.y + split, this.width, this.height - split);
    } else {
      this.leftChild = new BSPNode(this.x, this.y, split, this.height);
      this.rightChild = new BSPNode(this.x + split, this.y, this.width - split, this.height);
    }

    return true;
  }

  createRoom(minRoomSize, maxRoomSize) {
    if (this.leftChild !== null || this.rightChild !== null) {
      // Not a leaf, create rooms in children
      if (this.leftChild !== null) {
        this.leftChild.createRoom(minRoomSize, maxRoomSize);
      }
      if (this.rightChild !== null) {
        this.rightChild.createRoom(minRoomSize, maxRoomSize);
      }
    } else {
      // Leaf node, create a room
      const roomWidth = Math.min(
        Math.floor(Math.random() * (maxRoomSize - minRoomSize)) + minRoomSize,
        this.width - 2
      );
      const roomHeight = Math.min(
        Math.floor(Math.random() * (maxRoomSize - minRoomSize)) + minRoomSize,
        this.height - 2
      );
      
      const roomX = this.x + Math.floor(Math.random() * (this.width - roomWidth - 1)) + 1;
      const roomY = this.y + Math.floor(Math.random() * (this.height - roomHeight - 1)) + 1;
      
      this.room = new Room(roomX, roomY, roomWidth, roomHeight);
    }
  }

  getRoom() {
    if (this.room !== null) {
      return this.room;
    }
    
    let leftRoom = null;
    let rightRoom = null;
    
    if (this.leftChild !== null) {
      leftRoom = this.leftChild.getRoom();
    }
    if (this.rightChild !== null) {
      rightRoom = this.rightChild.getRoom();
    }
    
    // Return a random room from children
    if (leftRoom === null) return rightRoom;
    if (rightRoom === null) return leftRoom;
    return Math.random() > 0.5 ? leftRoom : rightRoom;
  }

  getAllRooms() {
    const rooms = [];
    
    if (this.room !== null) {
      rooms.push(this.room);
    }
    
    if (this.leftChild !== null) {
      rooms.push(...this.leftChild.getAllRooms());
    }
    if (this.rightChild !== null) {
      rooms.push(...this.rightChild.getAllRooms());
    }
    
    return rooms;
  }
}

/**
 * Generate a procedural dungeon using BSP algorithm
 * @param {number} size - Size of the dungeon (size x size)
 * @param {number} minRoomSize - Minimum room dimension
 * @param {number} maxRoomSize - Maximum room dimension
 * @param {number} recursionDepth - How many times to split the space
 * @param {number} seed - Random seed for reproducible dungeons
 * @returns {Object} Dungeon data with map, rooms, playerStart, and exit
 */
export function generateDungeon(
  size = 24,
  minRoomSize = 4,
  maxRoomSize = 8,
  recursionDepth = 4,
  seed = null
) {
  // Initialize map with walls (1 = wall, 0 = empty)
  const mapData = new Uint8Array(size * size);
  mapData.fill(1);

  // Create root BSP node
  const root = new BSPNode(0, 0, size, size);

  // Recursively split the space
  const containers = [root];
  for (let i = 0; i < recursionDepth; i++) {
    const currentContainers = [...containers];
    for (const container of currentContainers) {
      if (container.split(minRoomSize)) {
        containers.push(container.leftChild);
        containers.push(container.rightChild);
        // Remove parent from list
        const index = containers.indexOf(container);
        if (index > -1) {
          containers.splice(index, 1);
        }
      }
    }
  }

  // Create rooms in leaf nodes
  root.createRoom(minRoomSize, maxRoomSize);

  // Get all rooms
  const rooms = root.getAllRooms();

  // Carve out rooms in the map
  for (const room of rooms) {
    for (let x = room.x; x < room.x + room.width; x++) {
      for (let y = room.y; y < room.y + room.height; y++) {
        if (x >= 0 && x < size && y >= 0 && y < size) {
          mapData[y * size + x] = 0;
        }
      }
    }
  }

  // Connect rooms with corridors
  connectRooms(root, mapData, size);

  // Place player start in first room
  const startRoom = rooms[0];
  const playerStart = {
    x: startRoom.centerX,
    y: startRoom.centerY
  };

  // Place exit portal in last room
  const exitRoom = rooms[rooms.length - 1];
  const exit = {
    x: exitRoom.centerX,
    y: exitRoom.centerY
  };
  
  // Mark exit in map (9 = exit portal)
  if (exit.x >= 0 && exit.x < size && exit.y >= 0 && exit.y < size) {
    mapData[exit.y * size + exit.x] = 9;
  }

  return {
    mapData,
    size,
    rooms,
    playerStart,
    exit
  };
}

/**
 * Connect rooms with corridors
 */
function connectRooms(node, mapData, size) {
  if (node.leftChild === null || node.rightChild === null) {
    return; // Leaf node, no connection needed
  }

  // Recursively connect children
  connectRooms(node.leftChild, mapData, size);
  connectRooms(node.rightChild, mapData, size);

  // Get rooms from left and right children
  const leftRoom = node.leftChild.getRoom();
  const rightRoom = node.rightChild.getRoom();

  if (leftRoom && rightRoom) {
    // Create corridor between rooms
    createCorridor(leftRoom, rightRoom, mapData, size);
  }
}

/**
 * Create a corridor between two rooms
 */
function createCorridor(room1, room2, mapData, size) {
  const x1 = room1.centerX;
  const y1 = room1.centerY;
  const x2 = room2.centerX;
  const y2 = room2.centerY;

  // Randomly choose L-shaped or straight corridor
  if (Math.random() > 0.5) {
    // Horizontal then vertical
    createHorizontalTunnel(x1, x2, y1, mapData, size);
    createVerticalTunnel(y1, y2, x2, mapData, size);
  } else {
    // Vertical then horizontal
    createVerticalTunnel(y1, y2, x1, mapData, size);
    createHorizontalTunnel(x1, x2, y2, mapData, size);
  }
}

/**
 * Create a horizontal tunnel
 */
function createHorizontalTunnel(x1, x2, y, mapData, size) {
  const minX = Math.min(x1, x2);
  const maxX = Math.max(x1, x2);
  
  for (let x = minX; x <= maxX; x++) {
    if (x >= 0 && x < size && y >= 0 && y < size) {
      mapData[y * size + x] = 0;
    }
  }
}

/**
 * Create a vertical tunnel
 */
function createVerticalTunnel(y1, y2, x, mapData, size) {
  const minY = Math.min(y1, y2);
  const maxY = Math.max(y1, y2);
  
  for (let y = minY; y <= maxY; y++) {
    if (x >= 0 && x < size && y >= 0 && y < size) {
      mapData[y * size + x] = 0;
    }
  }
}

/**
 * Get spawn positions for enemies in rooms (avoiding player start and exit)
 * @param {Array} rooms - Array of Room objects
 * @param {Object} playerStart - Player start position
 * @param {Object} exit - Exit position
 * @param {number} count - Number of spawn positions to generate
 * @returns {Array} Array of {x, y} positions
 */
export function getEnemySpawnPositions(rooms, playerStart, exit, count = 10) {
  const spawnPositions = [];
  const usedRooms = new Set();
  
  // Skip first and last room (player start and exit)
  const availableRooms = rooms.slice(1, -1);
  
  if (availableRooms.length === 0) {
    return spawnPositions;
  }
  
  for (let i = 0; i < count; i++) {
    const room = availableRooms[Math.floor(Math.random() * availableRooms.length)];
    
    // Random position within room
    const x = room.x + Math.floor(Math.random() * room.width);
    const y = room.y + Math.floor(Math.random() * room.height);
    
    spawnPositions.push({ x, y });
  }
  
  return spawnPositions;
}

/**
 * Get NPC spawn position (typically in a central room)
 * @param {Array} rooms - Array of Room objects
 * @returns {Object} {x, y} position
 */
export function getNPCSpawnPosition(rooms) {
  if (rooms.length === 0) {
    return { x: 12, y: 12 }; // Default center
  }
  
  // Place NPC in middle room
  const middleRoom = rooms[Math.floor(rooms.length / 2)];
  return {
    x: middleRoom.centerX,
    y: middleRoom.centerY
  };
}
