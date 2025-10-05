import { useState } from 'react';

export default function Inventory({ initialItems = [] }) {
  const [items, setItems] = useState(initialItems);
  const [isOpen, setIsOpen] = useState(false);
  
  // Function to add an item to the inventory
  const addItem = (item) => {
    setItems(prevItems => {
      const newItems = [...prevItems];
      const existingItem = newItems.find(i => i.id === item.id);
      
      if (existingItem) {
        // If item exists, increase quantity
        existingItem.quantity += item.quantity || 1;
      } else {
        // Add new item
        newItems.push({
          id: item.id,
          name: item.name,
          description: item.description,
          quantity: item.quantity || 1,
          icon: item.icon || null
        });
      }
      
      return newItems;
    });
  };
  
  // Function to remove an item from the inventory
  const removeItem = (itemId, quantity = 1) => {
    setItems(prevItems => {
      const newItems = [...prevItems];
      const itemIndex = newItems.findIndex(i => i.id === itemId);
      
      if (itemIndex !== -1) {
        const item = newItems[itemIndex];
        item.quantity -= quantity;
        
        // Remove item if quantity is 0 or less
        if (item.quantity <= 0) {
          newItems.splice(itemIndex, 1);
        }
      }
      
      return newItems;
    });
  };
  
  // Function to use an item
  const useItem = (itemId) => {
    const item = items.find(i => i.id === itemId);
    if (item && item.quantity > 0) {
      // In a real implementation, this would trigger item effects
      console.log(`Using item: ${item.name}`);
      
      // Decrease quantity after use
      removeItem(itemId, 1);
      
      return item;
    }
    return null;
  };
  
  return (
    <div className="absolute top-4 right-4">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="bg-gray-800 text-white p-2 rounded"
      >
        Inventory ({items.length})
      </button>
      
      {isOpen && (
        <div className="absolute top-12 right-0 bg-gray-900 text-white p-4 rounded shadow-lg w-64">
          <h3 className="text-lg font-bold mb-2">Inventory</h3>
          {items.length === 0 ? (
            <p className="text-gray-400">No items</p>
          ) : (
            <ul>
              {items.map(item => (
                <li key={item.id} className="flex justify-between items-center mb-2">
                  <div>
                    <span className="font-semibold">{item.name}</span>
                    <span className="text-gray-400 ml-2">x{item.quantity}</span>
                  </div>
                  <button 
                    onClick={() => useItem(item.id)}
                    className="bg-blue-500 hover:bg-blue-700 text-white text-xs py-1 px-2 rounded"
                  >
                    Use
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}