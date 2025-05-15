import { useState, useEffect } from 'react'
import './App.css'

const RASPBERRY_PI_IP = "192.168.50.190"; // ← EDIT THIS
const STREAM_PORT = "8080";
const DATA_PORT = "8000";
const STREAM_URL = `http://${RASPBERRY_PI_IP}:${STREAM_PORT}/video_feed`;
function App() {
  // Get current date in local string format
  const getCurrentDateTime = () => {
    const now = new Date();
    return {
      date: now.toLocaleDateString(),
      time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
  };
  
  const [currentDateTime] = useState(getCurrentDateTime())
  const [notices, setNotices] = useState([
    // { id: 1, date: currentDateTime.date, time: currentDateTime.time, message: 'Door unlocked', method: 'Voice' },
    // { id: 2, date: '2025-05-12', time: '14:35', message: 'Door unlocked', method: 'QR Code' },
    // { id: 3, date: '2025-05-12', time: '09:17', message: 'Access denied', method: 'Morse Code' },
  ])
  const [isFullScreen, setIsFullScreen] = useState(false)
  const [showManageModal, setShowManageModal] = useState(false)
  const [activeMethod, setActiveMethod] = useState(null) // 'qr', 'morse', or 'voice'
  const [passToDelete, setPassToDelete] = useState(null) // Track pass pending deletion for confirmation
  
  // Separate state for each method type
  const [qrPasses, setQrPasses] = useState([
    { }
  ])
  const [invalidQrPasses, setInvalidQrPasses] = useState([]) // Track deleted QR passes
  const [morsePasses, setMorsePasses] = useState([
    // { id: 1, name: 'Guest Morse', type: 'one-time', expiryTime: '2025-05-15T18:00' }
  ])
  const [invalidMorsePasses, setInvalidMorsePasses] = useState([]) // Track deleted/expired Morse passes
  const [voicePasses, setVoicePasses] = useState([
    { id: 1, name: 'Alex', type: 'multiple-pass', expiryTime: '2026-05-15T21:00' },
    { id: 2, name: 'Hinson', type: 'multiple-pass', expiryTime: '2026-05-15T21:00' },
    { id: 3, name: 'Samuel', type: 'multiple-pass', expiryTime: '2026-05-15T21:00' }
  ])
  const [invalidVoicePasses, setInvalidVoicePasses] = useState([]) // Track deleted/expired Voice passes
  
  // Track the highest ID for each pass type
  const [nextQrId, setNextQrId] = useState(1)
  const [nextMorseId, setNextMorseId] = useState(1)
  const [nextVoiceId, setNextVoiceId] = useState(4)
  
  const [editingPass, setEditingPass] = useState(null)
  const [isCreatingPass, setIsCreatingPass] = useState(false)
  
  // Sorting state for valid passes
  const [sortField, setSortField] = useState('name') // Default sort by name
  const [sortDirection, setSortDirection] = useState('asc') // Default sort direction
  
  // Sorting state for invalid passes
  const [invalidSortField, setInvalidSortField] = useState('deletionTime') // Default sort by deletion time
  const [invalidSortDirection, setInvalidSortDirection] = useState('desc') // Default sort direction (newest first)
  
  // States for Morse code password creation
  const [morsePassword, setMorsePassword] = useState('')
  const [isManualMorseInput, setIsManualMorseInput] = useState(false)
  const [morseCreationStep, setMorseCreationStep] = useState(0) // 0: choose method, 1: inputting, 2: review
  const [previewPass, setPreviewPass] = useState(null) // For pass preview modal
  const [isLoading, setIsLoading] = useState(false); // Loading state

  // Function to reset Morse code related states
  const resetMorseStates = () => {
    setMorsePassword('');
    setIsManualMorseInput(false);
    setMorseCreationStep(0);
  };

  // Handle ESC key press to close modals
  useEffect(() => {
    const handleEscKey = (event) => {
      if (event.key === 'Escape') {
        if (isFullScreen) setIsFullScreen(false);
        if (showManageModal) {
          setShowManageModal(false);
          setEditingPass(null);  // Reset editing pass state
          setIsCreatingPass(false); // Reset creating pass state
          resetMorseStates(); // Reset Morse code states
        }
      }
    };
    
    window.addEventListener('keydown', handleEscKey);
    return () => window.removeEventListener('keydown', handleEscKey);
  }, [isFullScreen, showManageModal]);
  
  // Enforce Morse code to be one-time pass only
  useEffect(() => {
    if (activeMethod === 'morse' && editingPass && editingPass.type !== 'one-time') {
      setEditingPass({
        ...editingPass,
        type: 'one-time'
      });
    }
  }, [activeMethod, editingPass?.id]);
  
  useEffect(() => {
    if (showManageModal && (activeMethod === 'qr' || activeMethod === 'morse')) {
      // Initial fetch when modal opens for QR or Morse
      loadDataForMethod(activeMethod);

      // Clean up on unmount or when modal closes
      return;
    }
  }, [showManageModal, activeMethod]);

    // WebSocket for real-time notices
  useEffect(() => {
    const ws = new WebSocket(`ws://${RASPBERRY_PI_IP}:${DATA_PORT}/ws/actions`);

    ws.onopen = () => {
      console.log('WebSocket connection established');
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (Array.isArray(data)) {
          // Map backend format to notices format
          const newNotices = data.map((item, idx) => {
            const dateObj = new Date(item.action_time);
            return {
              id: idx + 1, // or use a better unique id if available
              date: dateObj.toLocaleDateString(),
              time: dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }), // include seconds
              message: item.action,
              method: item.action_type
            };
          });
          // Sort by action_time descending (latest first)
          newNotices.sort((a, b) => {
            const aTime = new Date(data[a.id - 1].action_time).getTime();
            const bTime = new Date(data[b.id - 1].action_time).getTime();
            return bTime - aTime;
          });
          setNotices(newNotices);
        }
      } catch (err) {
        console.error('WebSocket message error:', err);
      }
    };

    ws.onclose = () => {
      console.log('WebSocket connection closed');
    };

    ws.onerror = (err) => {
      console.error('WebSocket error:', err);
    };

    return () => {
      ws.close();
    };
  }, []);

  // Load data for QR and Morse codes when component mounts
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        // Set loading state while we fetch data
        setIsLoading(true);
        
        // Load QR code data
        await loadDataForMethod('qr');
        
        // Load Morse code data
        await loadDataForMethod('morse');
        
        console.log('Initial data loaded successfully');
      } catch (error) {
        console.error('Error loading initial data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadInitialData();
  }, []); // Empty dependency array means this runs once on component mount
  
  // Check for expired voice passes when component loads or when voicePasses changes
  useEffect(() => {
    const currentTime = new Date().getTime();
    
    // Find expired voice passes
    const expiredVoicePasses = voicePasses.filter(pass => {
      return new Date(pass.expiryTime).getTime() <= currentTime;
    });
    
    if (expiredVoicePasses.length > 0) {
      // Remove expired passes from valid passes
      setVoicePasses(voicePasses.filter(pass => {
        return new Date(pass.expiryTime).getTime() > currentTime;
      }));
      
      // Add expired passes to invalid passes
      setInvalidVoicePasses(prev => [...prev, ...expiredVoicePasses.map(pass => ({
        ...pass,
        deletionTime: null // No deletion time, but expired
      }))]);
    }
  }, [voicePasses]);
  
  // Get method details based on activeMethod
  const getMethodDetails = () => {
    switch(activeMethod) {
      case 'qr':
        return {
          title: 'QR Code Management',
          icon: '/src/assets/qr-code.png',
          description: 'Manage your QR code passes for door access'
        };
      case 'morse':
        return {
          title: 'Morse Code Management',
          icon: null, // We'll use text instead
          description: 'Manage your one-time Morse code passes. For enhanced security, Morse code only supports one-time passes.'
        };
      case 'voice':
        return {
          title: 'Voice Recognition Management',
          icon: '/src/assets/voice.png',
          description: 'Manage your voice recognition passes for door access'
        };
      default:
        return {
          title: 'Access Management',
          icon: null,
          description: 'Manage your passes'
        };
    }
  }
  
  // Helper function to get the current active passes based on method
  const getActivePasses = () => {
    switch(activeMethod) {
      case 'qr':
        return qrPasses;
      case 'morse':
        return morsePasses;
      case 'voice':
        return voicePasses;
      default:
        return [];
    }
  }
  
  // Helper function to get the current invalid passes based on method
  const getInvalidPasses = () => {
    switch(activeMethod) {
      case 'qr':
        return invalidQrPasses;
      case 'morse':
        return invalidMorsePasses;
      case 'voice':
        return invalidVoicePasses;
      default:
        return [];
    }
  }
  
  // Function to handle sorting of valid passes
  const handleSortClick = (field) => {
    // If clicking the same field, toggle direction
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // If clicking a new field, set it as the sort field and default to ascending
      setSortField(field);
      setSortDirection('asc');
    }
  }
  
  // Function to handle sorting of invalid passes
const handleInvalidSortClick = (field) => {
  // If clicking the same field, toggle direction
  if (invalidSortField === field) {
    setInvalidSortDirection(invalidSortDirection === 'asc' ? 'desc' : 'asc');
  } else {
    // If clicking a new field, set it as the sort field and default to ascending
    setInvalidSortField(field);
    // Default to descending for date fields, ascending for others
    setInvalidSortDirection(field === 'deletionTime' ? 'desc' : 'asc');
  }
}
  
  // Function to sort passes based on current sort field and direction
  const getSortedPasses = (passes) => {
    if (!passes || passes.length === 0) return [];
    
    return [...passes].sort((a, b) => {
      let aValue, bValue;
      
      // Get the values to compare based on the sort field
      switch(sortField) {
        case 'id':
          aValue = a.id;
          bValue = b.id;
          break;
        case 'name':
          aValue = a.name ? a.name.toLowerCase() : '';
          bValue = b.name ? b.name.toLowerCase() : '';
          break;
        case 'type':
          aValue = a.type;
          bValue = b.type;
          break;
        case 'expiryTime':
          aValue = new Date(a.expiryTime).getTime();
          bValue = new Date(b.expiryTime).getTime();
          break;
        case 'deletionTime':
          aValue = a.deletionTime ? new Date(a.deletionTime).getTime() : 0;
          bValue = b.deletionTime ? new Date(b.deletionTime).getTime() : 0;
          break;
        default:
          aValue = a.name ? a.name.toLowerCase() : '';
          bValue = b.name ? a.name.toLowerCase() : '';
      }
      
      // Sort based on direction
      if (sortDirection === 'asc') {
        return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
      } else {
        return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
      }
    });
  }

  // Function to sort invalid passes based on invalid sort field and direction
  const getSortedInvalidPasses = (passes) => {
    if (!passes || passes.length === 0) return [];
    
    return [...passes].sort((a, b) => {
      let aValue, bValue;
      
      // Get the values to compare based on the sort field
      switch(invalidSortField) {
        case 'id':
          aValue = a.id;
          bValue = b.id;
          break;
        case 'name':
          aValue = a.name ? a.name.toLowerCase() : '';
          bValue = b.name ? b.name.toLowerCase() : '';
          break;
        case 'type':
          aValue = a.type;
          bValue = b.type;
          break;
        case 'status':
          // Sort by status text ('Deleted' or 'Expired')
          aValue = a.deletionTime ? 'Deleted' : 'Expired';
          bValue = b.deletionTime ? 'Deleted' : 'Expired';
          break;
        case 'deletionTime':
          // If we have deletion time, use it, otherwise use expiry time
          aValue = a.deletionTime ? 
            new Date(a.deletionTime).getTime() : 
            new Date(a.expiryTime).getTime();
          
          bValue = b.deletionTime ? 
            new Date(b.deletionTime).getTime() : 
            new Date(b.expiryTime).getTime();
          break;
        default:
          // Default to sorting by status time (deletion or expiry)
          aValue = a.deletionTime ? 
            new Date(a.deletionTime).getTime() : 
            new Date(a.expiryTime).getTime();
          
          bValue = b.deletionTime ? 
            new Date(b.deletionTime).getTime() : 
            new Date(b.expiryTime).getTime();
      }
      
      // Sort based on direction
      if (invalidSortDirection === 'asc') {
        return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
      } else {
        return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
      }
    });
  }

  // Convert Morse code to binary (. = 0, ._ = 1)
  const convertMorseToBinary = (morseCode) => {
    // Parse the morse units from the provided code
    const morseUnits = parseMorseUnits(morseCode);
    
    // Remove the last dot (which should always be a single dot)
    const morseUnitsWithoutLastDot = morseUnits.slice(0, -1);
    
    // Convert to binary (. -> 0, ._ -> 1)
    let binaryPassword = '';
    for (const unit of morseUnitsWithoutLastDot) {
      if (unit === '.') {
        binaryPassword += '0';
      } else if (unit === '._') {
        binaryPassword += '1';
      }
    }
    
    return binaryPassword;
  };

  // Function to parse morse units (._ as one unit and . as another unit)
  const parseMorseUnits = (morseString) => {
    const units = [];
    let i = 0;
    
    while (i < morseString.length) {
      if (morseString.substring(i, i+2) === '._') {
        units.push('._');
        i += 2;
      } else {
        units.push(morseString[i]);
        i += 1;
      }
    }
    
    return units;
  };
  
  // Get the count of morse units (treats ._ as a single digit)
  const countMorseUnits = (morseString) => {
    return parseMorseUnits(morseString).length;
  };

  // Function to load data for a specific method
  const loadDataForMethod = async (method) => {
    try {
      const response = await fetch(`http://${RASPBERRY_PI_IP}:${DATA_PORT}/update_database`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          method: method,
        })
      });

      if (response.ok) {
        let data = await response.json();
        
        if (method === "morse") {
          const mappedPasses = data.map(item => ({
            id: item.id,
            name: item.name,
            type: 'one-time',
            expiryTime: item.expiration_time,
            morsePassword: item.knock_password,
            binaryPassword: item.password,
            knockPassword: item.knock_password.substring(0, item.knock_password.length-1),
            deletionTime: item.deletion_time
          }));
          
          // Get current time for expiry check
          const currentTime = new Date().getTime();
          
          // Filter passes
          const validPasses = mappedPasses.filter(pass => {
            return pass.deletionTime === null && new Date(pass.expiryTime).getTime() > currentTime;
          });
          
          const invalidPasses = mappedPasses.filter(pass => {
            return pass.deletionTime !== null || new Date(pass.expiryTime).getTime() <= currentTime;
          });
          
          setMorsePasses(validPasses);
          setInvalidMorsePasses(invalidPasses);
          
          // Update next Morse ID
          if (mappedPasses.length > 0) {
            const highestId = Math.max(...mappedPasses.map(pass => pass.id));
            setNextMorseId(highestId + 1);
          } else {
            setNextMorseId(1);
          }
        } 
        else if (method === "qr") {
          const mappedPasses = data.map(item => ({
            id: item.id,
            name: item.name,
            password: item.password,
            type: item.type,
            creationTime: item.creation_time,
            expiryTime: item.expiration_time,
            deletionTime: item.deletion_time,
          }));
          
          // Get current time for expiry check
          const currentTime = new Date().getTime();
          
          // Filter passes
          const validPasses = mappedPasses.filter(pass => {
            return pass.deletionTime === null && new Date(pass.expiryTime).getTime() > currentTime;
          });
          
          const invalidPasses = mappedPasses.filter(pass => {
            return pass.deletionTime !== null || new Date(pass.expiryTime).getTime() <= currentTime;
          });
          
          setQrPasses(validPasses);
          setInvalidQrPasses(invalidPasses);
          
          // Update next QR ID
          if (mappedPasses.length > 0) {
            const highestId = Math.max(...mappedPasses.map(pass => pass.id));
            setNextQrId(highestId + 1);
          } else {
            setNextQrId(1);
          }
        }
      }
    } catch (error) {
      console.error(`Error loading data for ${method}:`, error);
    }
  };

  // Get the nearest expiring pass for a method
  const getNearestExpiringPass = (method) => {
    let passes;
    switch(method) {
      case 'qr':
        passes = qrPasses;
        break;
      case 'morse':
        passes = morsePasses;
        break;
      case 'voice':
        passes = voicePasses;
        break;
      default:
        passes = [];
    }
    
    // Filter out passes without expiry time
    const passesWithExpiry = passes.filter(pass => pass.expiryTime);
    
    // If no passes with expiry, return null
    if (passesWithExpiry.length === 0) return null;
    
    // Sort by expiry time (ascending)
    const sortedPasses = [...passesWithExpiry].sort((a, b) => {
      return new Date(a.expiryTime) - new Date(b.expiryTime);
    });
    
    // Return the soonest expiring pass
    return sortedPasses[0];
  };

  /* APIs */
  const update_database = async () => {
    try {
      setIsLoading(true);
      // Use the loadDataForMethod function to load data for the active method
      await loadDataForMethod(activeMethod);
    } catch (error) {
      console.error('Error updating database:', error);
    } finally {
      setIsLoading(false);
    }
  }

  const add_entry_in_db = async (passtoAdd) => {
    try {
      setIsLoading(true);
      const response = await fetch(`http://${RASPBERRY_PI_IP}:${DATA_PORT}/add_entry`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: passtoAdd.id,
          name: passtoAdd.name,
          type: passtoAdd.type,
          expiration_time: passtoAdd.expiryTime,
          // Only include these two when it is morse code
          ...(activeMethod === "morse" && {
            knock_password: passtoAdd.morsePassword,
            password: passtoAdd.binaryPassword
          }),
          method: activeMethod,
        })});

      if (response.ok) {
        await update_database();
      }
    } catch (error) {
      console.error('Error adding entry:', error);
    } finally {
      setIsLoading(false);
    }
  }

  const edit_entry_in_db = async (passtoEdit) => {
    try {
      setIsLoading(true);
      // Find the original pass to compare with
      let originalPass;
      if (activeMethod === 'qr') {
        originalPass = qrPasses.find(pass => pass.id === passtoEdit.id);
      } else if (activeMethod === 'morse') {
        originalPass = morsePasses.find(pass => pass.id === passtoEdit.id);
      } else if (activeMethod === 'voice') {
        originalPass = voicePasses.find(pass => pass.id === passtoEdit.id);
      }

      // Compare and only send changed fields
      const payload = {
        id: passtoEdit.id,
        name: originalPass && originalPass.name === passtoEdit.name ? null : passtoEdit.name,
        type: originalPass && originalPass.type === passtoEdit.type ? null : passtoEdit.type,
        expiration_time: originalPass && originalPass.expiryTime === passtoEdit.expiryTime ? null : passtoEdit.expiryTime,
        method: activeMethod,
      };

      // Only include these two when it is morse code
      if (activeMethod === "morse") {
        payload.knock_password = originalPass && originalPass.morsePassword === passtoEdit.morsePassword 
          ? null 
          : passtoEdit.morsePassword;
        
        payload.password = originalPass && originalPass.binaryPassword === passtoEdit.binaryPassword 
          ? null 
          : passtoEdit.binaryPassword;
      }

      const response = await fetch(`http://${RASPBERRY_PI_IP}:${DATA_PORT}/edit_entry`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        await update_database();
      }
    } catch (error) {
      console.error('Error editing entry:', error);
    } finally {
      setIsLoading(false);
    }
  }

  const delete_entry_in_db = async (id) => {
    try {
      setIsLoading(true);
      const response = await fetch(`http://${RASPBERRY_PI_IP}:${DATA_PORT}/delete_entry`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: id,
          method: activeMethod,
        })});

      if (response.ok) {
        await update_database();
      }
    } catch (error) {
      console.error('Error deleting entry:', error);
    } finally {
      setIsLoading(false);
    }
  }
  /* End of APIs */

  // Add new pass
  const addNewPass = (pass) => {
    let passToAdd = pass;
    
    // For Morse code passes, calculate binary password and keep the knock_password
    if (activeMethod === 'morse' && morsePassword) {
      const binaryPassword = convertMorseToBinary(morsePassword);
      const knockPassword = morsePassword.substring(0, morsePassword.length-1);      
      passToAdd = {
        ...pass,
        morsePassword: morsePassword,
        binaryPassword: binaryPassword,
        knockPassword: knockPassword
      };
      
      console.log('Morse password:', morsePassword);
      console.log('Binary password:', binaryPassword);
      console.log('Knock password:', knockPassword);
    }

    // Add to database via API
    if (activeMethod === 'qr') {
      add_entry_in_db(passToAdd);
    } else if (activeMethod === 'morse') {
      add_entry_in_db(passToAdd);
    } else if (activeMethod === 'voice') {
      setVoicePasses([...voicePasses, passToAdd]);
      setNextVoiceId(nextVoiceId + 1);
    }
    
    setEditingPass(null);
    setIsCreatingPass(false);
    
    // Add notice for new pass creation
    const methodName = activeMethod === 'qr' ? 'QR Code' : 
                     activeMethod === 'morse' ? 'Morse Code' : 'Voice';
    addNotice(`New ${pass.type} created`, methodName);
  };

  // Show delete confirmation
  const deletePass = (id) => {
    // Find the pass to be deleted
    let pass;
    if (activeMethod === 'qr') {
      pass = qrPasses.find(p => p.id === id);
    } else if (activeMethod === 'morse') {
      pass = morsePasses.find(p => p.id === id);
    } else if (activeMethod === 'voice') {
      pass = voicePasses.find(p => p.id === id);
    }
    
    // Set the pass to delete for confirmation modal
    setPassToDelete(pass);
  };

  // Confirm and execute deletion
  const confirmDeletePass = () => {
    if (!passToDelete) return;
    
    const id = passToDelete.id;
    
    // Perform the actual deletion
    if (activeMethod === 'qr') {
      delete_entry_in_db(id);
    } else if (activeMethod === 'morse') {
      delete_entry_in_db(id);
    } else if (activeMethod === 'voice') {
      // For voice passes, we'll do a soft delete by marking with deletionTime
      const passToMarkDeleted = voicePasses.find(pass => pass.id === id);
      if (passToMarkDeleted) {
        // Remove from valid passes
        setVoicePasses(voicePasses.filter(pass => pass.id !== id));
        
        // Add to invalid passes with current deletion time
        const deletedPass = {
          ...passToMarkDeleted,
          deletionTime: new Date().toISOString()
        };
        setInvalidVoicePasses([...invalidVoicePasses, deletedPass]);
      }
    }
    
    if (editingPass && editingPass.id === id) {
      setEditingPass(null);
    }
    
    // Add notice for deletion
    const methodName = activeMethod === 'qr' ? 'QR Code' : 
                      activeMethod === 'morse' ? 'Morse Code' : 'Voice';
    addNotice(`${passToDelete.name} deleted`, methodName);
    
    // Clear the pass to delete
    setPassToDelete(null);
  };
  
  // Add new notice
  const addNotice = (message, method) => {
    const { date, time } = getCurrentDateTime();
    
    // Get the next notice ID (latest ID + 1)
    const nextId = notices.length > 0 
      ? Math.max(...notices.map(notice => notice.id)) + 1 
      : 1;
    
    const newNotice = {
      id: nextId,
      date,
      time,
      message,
      method
    };
    setNotices([newNotice, ...notices].slice(0, 20)); // Keep only the last 20 notices
  };

  // Update pass
  const updatePass = (updatedPass) => {
    // Update in database via API based on active method
    if (activeMethod === 'qr') {
      edit_entry_in_db(updatedPass);
    } else if (activeMethod === 'morse') {
      edit_entry_in_db(updatedPass);
    } else if (activeMethod === 'voice') {
      setVoicePasses(voicePasses.map(pass => pass.id === updatedPass.id ? updatedPass : pass));
    }
    
    setEditingPass(null);
    
    // Add notice for the update
    const methodName = activeMethod === 'qr' ? 'QR Code' : 
                       activeMethod === 'morse' ? 'Morse Code' : 'Voice';
    addNotice(`${updatedPass.name} updated`, methodName);
  };
  
  return (
    <div className="app-container">
      {/* Header */}
      <div className="heading_div">
        <div className="heading_left_div">
          <div>
            <img className="logo"
              src={`/door_lock.png`}
              alt="Door Lock Logo"
            />
          </div>
          <div className={`logo_text`}>
            Smart Lock Management System
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="main-content">
        {/* Camera Section */}
        <div className="camera-section">
          <h2 className="section-title">Real-time Camera</h2>
          <div className="camera-container" onClick={() => setIsFullScreen(true)}>
            {/* MJPG Stream (works with most browsers) */}
            <img
              src={STREAM_URL}
              alt="Live Camera Feed"
              onError={(e) => {
                e.target.src = `${STREAM_URL}&t=${Date.now()}`; // Force refresh
              }}
            />

            {/* Overlay (only shown when not fullscreen) */}
            {!isFullScreen && (
              <div className="camera-overlay">
                <span>Click to Full Screen</span>
              </div>
            )}
          </div>
        </div>
        
        {/* Full Screen Modal */}
        {isFullScreen && (
          <div className="fullscreen-modal" onClick={() => setIsFullScreen(false)}>
            <div className="fullscreen-content" onClick={(e) => e.stopPropagation()}>
              <div className="fullscreen-header">
                <h3>Real-time Camera Feed</h3>
                <button className="close-btn" onClick={() => setIsFullScreen(false)}>×</button>
              </div>
              <div className="fullscreen-camera">
                <img
                  src={STREAM_URL}
                  alt="Fullscreen Camera Feed"
                  onError={(e) => {
                    e.target.src = `${STREAM_URL}&t=${Date.now()}`;
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Notice Section - Middle Column */}
        <div className="notice-section">
          <h2 className="section-title">Notices</h2>
          <div className="notice-list">
            {notices.map(notice => (
              <div className="notice-item" key={notice.id}>
                <div className="notice-info">
                  <div className="notice-date">{notice.date} {notice.time}</div>
                  <div className="notice-method">{notice.method}</div>
                </div>
                <div className={`notice-message ${notice.message.toLowerCase().includes('denied') ? 'notice-error' : ''}`}>
                  {notice.message}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Unlock Methods - Right Column */}
        <div className="unlock-section">
          <h2 className="section-title">Unlock Methods</h2>
          
          <div className="unlock-method">
            <img className="method-icon qr-icon"
              src="/src/assets/qr-code.png"
              alt="QR Code Icon"
            />
            <div className="method-details">
              <div className="method-name">QR Code</div>
              <div className="method-status">
                <span>Soon expired: {getNearestExpiringPass('qr')?.name || 'None'}</span>
                <button className="manage-btn" onClick={() => {
                  setActiveMethod('qr');
                  setEditingPass(null);
                  setIsCreatingPass(false);
                  setShowManageModal(true);
                  // Refresh data when opening modal
                  loadDataForMethod('qr');
                }}>Manage</button>
              </div>
            </div>
          </div>
          
          <div className="unlock-method">
            <div className="method-icon morse-icon">•−</div>
            <div className="method-details">
              <div className="method-name">
                Morse Code
                <span className="method-badge">One-Time Only</span>
              </div>
              <div className="method-status">
                <span>Soon expired: {getNearestExpiringPass('morse')?.name || 'None'}</span>
                <button className="manage-btn" onClick={() => {
                  setActiveMethod('morse');
                  setEditingPass(null);
                  setIsCreatingPass(false);
                  setMorsePassword('');
                  setMorseCreationStep(0);
                  setShowManageModal(true);
                  // Refresh data when opening modal
                  loadDataForMethod('morse');
                }}>Manage</button>
              </div>
            </div>
          </div>
          
          <div className="unlock-method">
            <img className="method-icon voice-icon"
              src="/src/assets/voice.png"
              alt="Voice Icon"
            />
            <div className="method-details">
              <div className="method-name">Voice</div>
              <div className="method-status">
                <span>Soon expired: {getNearestExpiringPass('voice')?.name || 'None'}</span>
                <button className="manage-btn" onClick={() => {
                  setActiveMethod('voice');
                  setEditingPass(null);
                  setIsCreatingPass(false);
                  setShowManageModal(true);
                  // Note: Voice backend not implemented yet
                }}>Manage</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Management Modal */}
      {showManageModal && (
        <div className="manage-modal-backdrop" onClick={() => {
            setShowManageModal(false);
            setEditingPass(null);
            setIsCreatingPass(false);
            resetMorseStates();
          }}>
          <div className="manage-modal-content" onClick={e => e.stopPropagation()}>
            {isLoading && (
              <div className="loading-overlay">
                <div className="spinner"></div>
              </div>
            )}
            <div className="manage-modal-header">
              <div className="manage-modal-title">
                {activeMethod === 'morse' ? (
                  <div className="title-icon">•−</div>
                ) : (
                  <img 
                    src={getMethodDetails().icon} 
                    alt={`${getMethodDetails().title} Icon`} 
                    className="title-icon" 
                  />
                )}
                <h2>{getMethodDetails().title}</h2>
              </div>
              <button className="close-btn" onClick={() => {
                setShowManageModal(false);
                setEditingPass(null);
                setIsCreatingPass(false);
                resetMorseStates();
              }}>×</button>
            </div>
            
            <div className="manage-modal-body">
              <p className="modal-description">{getMethodDetails().description}</p>
              
              {!isCreatingPass && !editingPass ? (
                <>
                  <div className="pass-type-selection">
                    <h3>Create New Pass</h3>
                    <div className="pass-btn-group">
                      <button 
                        className="pass-btn one-time" 
                        onClick={() => {
                          // Get next ID based on active method
                          let nextId;
                          if (activeMethod === 'qr') {
                            nextId = nextQrId;
                          } else if (activeMethod === 'morse') {
                            nextId = nextMorseId;
                          } else if (activeMethod === 'voice') {
                            nextId = nextVoiceId;
                          }
                          
                          const newPass = {
                            id: nextId,
                            name: 'New Pass',
                            type: 'one-time',
                            expiryTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().substring(0, 16) // Default 1 week
                          };
                          setEditingPass(newPass);
                          setIsCreatingPass(true);
                        }}
                      >
                        One-Time Pass
                      </button>
                      {activeMethod !== 'morse' && (
                        <button 
                          className="pass-btn multiple" 
                          onClick={() => {
                            // Get next ID based on active method
                            let nextId;
                            if (activeMethod === 'qr') {
                              nextId = nextQrId;
                            } else if (activeMethod === 'morse') {
                              nextId = nextMorseId;
                            } else if (activeMethod === 'voice') {
                              nextId = nextVoiceId;
                            }
                            
                            const newPass = {
                              id: nextId,
                              name: 'New Pass',
                              type: 'multiple-pass',
                              expiryTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().substring(0, 16) // Default 1 week
                            };
                            setEditingPass(newPass);
                            setIsCreatingPass(true);
                          }}
                        >
                          Multiple Pass
                        </button>
                      )}
                    </div>
                  </div>
                  
                  <div className="passes-list">
                    <h3>Your Passes</h3>
                    <div className="passes-list-header">
                      <span className="col-id sortable" onClick={() => handleSortClick('id')}>
                        ID {sortField === 'id' && (sortDirection === 'asc' ? '▲' : '▼')}
                      </span>
                      <span className="col-name sortable" onClick={() => handleSortClick('name')}>
                        Name {sortField === 'name' && (sortDirection === 'asc' ? '▲' : '▼')}
                      </span>
                      <span className="col-type sortable" onClick={() => handleSortClick('type')}>
                        Type {sortField === 'type' && (sortDirection === 'asc' ? '▲' : '▼')}
                      </span>
                      <span className="col-expire sortable" onClick={() => handleSortClick('expiryTime')}>
                        Expiry Time {sortField === 'expiryTime' && (sortDirection === 'asc' ? '▲' : '▼')}
                      </span>
                      <span className="col-actions">Actions</span>
                    </div>
                    
                    {/* Display passes based on active method */}
                    {activeMethod === 'qr' && getSortedPasses(qrPasses).map(pass => (
                        <div className="pass-item" key={pass.id}>
                          <span className="col-id">{pass.id}</span>
                          <span className="col-name">{pass.name}</span>
                          <span className="col-type">{pass.type === 'one-time' ? 'One-Time' : 'Multiple'}</span>
                          <span className="col-expire">
                            {new Date(pass.expiryTime).toLocaleString()}
                          </span>
                          <div className="col-actions">
                            <button 
                              className="action-btn preview-btn"
                              onClick={() => {
                                setPreviewPass(pass);
                                setIsLoading(true);
                              }}
                            >
                              Preview
                            </button>
                            <button 
                              className="action-btn edit-btn"
                              onClick={() => setEditingPass(pass)}
                            >
                              Edit
                            </button>
                            <button 
                              className="action-btn delete-btn"
                              onClick={() => deletePass(pass.id)}
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                    ))}
                    
                    {activeMethod === 'morse' && getSortedPasses(morsePasses).map(pass => (
                        <div className="pass-item" key={pass.id}>
                          <span className="col-id">{pass.id}</span>
                          <span className="col-name">
                            {pass.name}
                            {pass.morsePassword && (
                              <span className="morse-mini-code" title={`Complete: ${pass.morsePassword}, Binary: ${pass.binaryPassword}`}>
                                {pass.morsePassword}
                              </span>
                            )}
                          </span>
                          <span className="col-type">One-Time</span>
                          <span className="col-expire">
                            {new Date(pass.expiryTime).toLocaleString()}
                          </span>
                          <div className="col-actions">
                            <button 
                              className="action-btn preview-btn"
                              onClick={() => setPreviewPass(pass)}
                            >
                              Preview
                            </button>
                            <button 
                              className="action-btn edit-btn"
                              onClick={() => {
                                setEditingPass(pass);
                                // If it has a morse password, load it
                                if (pass.morsePassword) {
                                  setMorsePassword(pass.morsePassword);
                                  setMorseCreationStep(2); // Go directly to confirmation step
                                }
                              }}
                            >
                              Edit
                            </button>
                            <button 
                              className="action-btn delete-btn"
                              onClick={() => deletePass(pass.id)}
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                    ))}
                    
                    {activeMethod === 'voice' && getSortedPasses(voicePasses).map(pass => (
                        <div className="pass-item" key={pass.id}>
                          <span className="col-id">{pass.id}</span>
                          <span className="col-name">{pass.name}</span>
                          <span className="col-type">{pass.type === 'one-time' ? 'One-Time' : 'Multiple'}</span>
                          <span className="col-expire">
                            {new Date(pass.expiryTime).toLocaleString()}
                          </span>
                          <div className="col-actions">
                            <button 
                              className="action-btn preview-btn"
                              onClick={() => setPreviewPass(pass)}
                            >
                              Preview
                            </button>
                            <button 
                              className="action-btn edit-btn"
                              onClick={() => setEditingPass(pass)}
                            >
                              Edit
                            </button>
                            <button 
                              className="action-btn delete-btn"
                              onClick={() => deletePass(pass.id)}
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                    ))}
                  </div>

                  {/* Invalid Passes Section - Shown for all methods when there are invalid passes */}
                  {((activeMethod === 'qr' && invalidQrPasses.length > 0) ||
                    (activeMethod === 'morse' && invalidMorsePasses.length > 0) ||
                    (activeMethod === 'voice' && invalidVoicePasses.length > 0)) && (
                    <div className="invalid-passes-list" style={{ marginTop: '2rem' }}>
                      <h3>Invalid Passes</h3>
                      <div className="invalid-passes-list-header">
                        <span className="col-id sortable" onClick={() => handleInvalidSortClick('id')}>
                          ID {invalidSortField === 'id' && (invalidSortDirection === 'asc' ? '▲' : '▼')}
                        </span>
                        <span className="col-name sortable" onClick={() => handleInvalidSortClick('name')}>
                          Name {invalidSortField === 'name' && (invalidSortDirection === 'asc' ? '▲' : '▼')}
                        </span>
                        <span className="col-type sortable" onClick={() => handleInvalidSortClick('type')}>
                          Type {invalidSortField === 'type' && (invalidSortDirection === 'asc' ? '▲' : '▼')}
                        </span>
                        <span className="col-status sortable" onClick={() => handleInvalidSortClick('status')}>
                          Status {invalidSortField === 'status' && (invalidSortDirection === 'asc' ? '▲' : '▼')}
                        </span>
                        <span className="col-date sortable" onClick={() => handleInvalidSortClick('deletionTime')}>
                          Date {invalidSortField === 'deletionTime' && (invalidSortDirection === 'asc' ? '▲' : '▼')}
                        </span>
                        <span className="col-actions">Actions</span>
                      </div>
                      
                      {/* QR Invalid Passes */}
                      {activeMethod === 'qr' && getSortedInvalidPasses(invalidQrPasses).map(pass => (
                        <div className="invalid-pass-item" key={pass.id}>
                          <span className="col-id">{pass.id}</span>
                          <span className="col-name">{pass.name}</span>
                          <span className="col-type">{pass.type === 'one-time' ? 'One-Time' : 'Multiple'}</span>
                          <span className="col-status">{pass.deletionTime ? 'Deleted' : 'Expired'}</span>
                          <span className="col-date">{pass.deletionTime ? new Date(pass.deletionTime).toLocaleString() : new Date(pass.expiryTime).toLocaleString()}</span>
                          <div className="col-actions">
                            <button 
                              className="action-btn preview-btn"
                              onClick={() => {
                                setPreviewPass(pass);
                                setIsLoading(true);
                              }}
                            >
                              Preview
                            </button>
                          </div>
                        </div>
                      ))}
                      
                      {/* Morse Invalid Passes */}
                      {activeMethod === 'morse' && getSortedInvalidPasses(invalidMorsePasses).map(pass => (
                        <div className="invalid-pass-item" key={pass.id}>
                          <span className="col-id">{pass.id}</span>
                          <span className="col-name">
                            {pass.name}
                            {pass.morsePassword && (
                              <span className="morse-mini-code" title={`Complete: ${pass.morsePassword}, Binary: ${pass.binaryPassword}`}>
                                {pass.morsePassword}
                              </span>
                            )}
                          </span>
                          <span className="col-type">One-Time</span>
                          <span className="col-status">{pass.deletionTime ? 'Deleted' : 'Expired'}</span>
                          <span className="col-date">{pass.deletionTime ? new Date(pass.deletionTime).toLocaleString() : new Date(pass.expiryTime).toLocaleString()}</span>
                          <div className="col-actions">
                            <button 
                              className="action-btn preview-btn"
                              onClick={() => setPreviewPass(pass)}
                            >
                              Preview
                            </button>
                          </div>
                        </div>
                      ))}
                      
                      {/* Voice Invalid Passes */}
                      {activeMethod === 'voice' && getSortedInvalidPasses(invalidVoicePasses).map(pass => (
                        <div className="invalid-pass-item" key={pass.id}>
                          <span className="col-id">{pass.id}</span>
                          <span className="col-name">{pass.name}</span>
                          <span className="col-type">{pass.type === 'one-time' ? 'One-Time' : 'Multiple'}</span>
                          <span className="col-status">{pass.deletionTime ? 'Deleted' : 'Expired'}</span>
                          <span className="col-date">{pass.deletionTime ? new Date(pass.deletionTime).toLocaleString() : new Date(pass.expiryTime).toLocaleString()}</span>
                          <div className="col-actions">
                            <button 
                              className="action-btn preview-btn"
                              onClick={() => setPreviewPass(pass)}
                            >
                              Preview
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="pass-edit-form">
                  <h3>{isCreatingPass ? 'Create New Pass' : 'Edit Pass'}</h3>
                  <div className="form-group">
                    <label>ID</label>
                    <input 
                      type="text"
                      value={editingPass.id}
                      readOnly
                      className="form-input"
                      style={{backgroundColor: '#f4f4f4'}}
                    />
                    <small className="form-note">Pass ID is automatically generated and cannot be changed</small>
                  </div>
                  
                  <div className="form-group">
                    <label>Name</label>
                    <input 
                      type="text"
                      value={editingPass.name}
                      onChange={(e) => setEditingPass({...editingPass, name: e.target.value})}
                      className="form-input"
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>Type</label>
                    <select
                      value={activeMethod === 'morse' ? 'one-time' : editingPass.type}
                      onChange={(e) => setEditingPass({...editingPass, type: e.target.value})}
                      className="form-select"
                      disabled={activeMethod === 'morse'}
                    >
                      <option value="one-time">One-Time Pass</option>
                      {activeMethod !== 'morse' && (
                        <option value="multiple-pass">Multiple Pass</option>
                      )}
                    </select>
                    {activeMethod === 'morse' && (
                      <small className="form-note">Morse code only supports one-time passes for security reasons</small>
                    )}
                  </div>
                  
                  <div className="form-group">
                    <label>Expiry Time</label>
                    <input 
                      type="datetime-local"
                      value={editingPass.expiryTime}
                      onChange={(e) => setEditingPass({...editingPass, expiryTime: e.target.value})}
                      className="form-input"
                    />
                  </div>
                  
                  {/* Morse Code Password Creation Interface */}
                  {activeMethod === 'morse' && (
                    <div className="morse-input-container">
                      <h4>Create Morse Code Password</h4>
                      
                      {/* Progress Tracker */}
                        <div className="morse-progress">
                          <div className={`morse-progress-step ${morseCreationStep >= 0 ? 'active' : ''}`}></div>
                          <div className={`morse-progress-step ${morseCreationStep >= 1 ? 'active' : ''}`}></div>
                          <div className={`morse-progress-step ${morseCreationStep >= 2 ? 'complete' : ''}`}></div>
                        </div>

                      {morseCreationStep === 0 && (
                        <div className="morse-input-method">
                          <button 
                            className={`morse-method-btn`}
                            onClick={() => {
                              setIsManualMorseInput(false);
                              setMorseCreationStep(1);
                              // Auto-generate a morse code password
                              const morseSigns = ['.', '._'];
                              let generatedPassword = '';
                              
                              // Generate exactly 6 morse units (either . or ._)
                              for (let i = 0; i < 6; i++) {
                                generatedPassword += morseSigns[Math.floor(Math.random() * 2)];
                              }
                              
                              // End with a dot as required
                              generatedPassword += '.';
                              setMorsePassword(generatedPassword);
                              
                              // Move to confirmation step after auto-generation
                              setMorseCreationStep(2);
                            }}
                          >
                            Auto-Generate
                          </button>
                          <button 
                            className={`morse-method-btn ${isManualMorseInput ? 'active' : ''}`}
                            onClick={() => {
                              setIsManualMorseInput(true);
                              setMorseCreationStep(1);
                              setMorsePassword('');
                            }}
                          >
                            Manual Input
                          </button>
                        </div>
                      )}
                      
                      
                      {/* Manual Input UI */}
                      {morseCreationStep === 1 && isManualMorseInput && (
                        <>
                          <div className="morse-code-display">
                            {morsePassword || 'Enter code here'}
                          </div>
                          
                          <div className="morse-buttons">
                            <button 
                              className="morse-btn dot"
                              onClick={() => {
                                // Count current morse units
                                const currentUnitCount = countMorseUnits(morsePassword);
                                
                                if (currentUnitCount < 6) {
                                  const newMorsePassword = morsePassword + '.';
                                  setMorsePassword(newMorsePassword);
                                  
                                  // Check if we've reached 6 digits (need to add final dot)
                                  if (countMorseUnits(newMorsePassword) === 6) {
                                    setMorsePassword(newMorsePassword + '.');
                                    setMorseCreationStep(2);
                                  }
                                }
                              }}
                            >
                              .
                            </button>
                            <button 
                              className="morse-btn dash"
                              onClick={() => {
                                // Count current morse units
                                const currentUnitCount = countMorseUnits(morsePassword);
                                
                                if (currentUnitCount < 6) {
                                  const newMorsePassword = morsePassword + '._';
                                  setMorsePassword(newMorsePassword);
                                  
                                  // Check if we've reached 6 digits (need to add final dot)
                                  if (countMorseUnits(newMorsePassword) === 6) {
                                    setMorsePassword(newMorsePassword + '.');
                                    setMorseCreationStep(2);
                                  }
                                }
                              }}
                            >
                              ._
                            </button>
                          </div>
                          
                          <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
                            <button 
                              className="action-btn cancel-btn"
                              onClick={() => setMorsePassword('')}
                              style={{ padding: '0.3rem 0.8rem' }}
                            >
                              Clear
                            </button>
                            <button 
                              className="action-btn preview-btn"
                              onClick={() => {
                                setIsManualMorseInput(false);
                                resetMorseStates();
                                setMorseCreationStep(0);
                              }}
                              style={{ padding: '0.3rem 0.8rem', marginLeft: '0.5rem' }}
                            >
                              Go Back
                            </button>
                          </div>
                          
                          <div className="morse-instructions">
                            <p>Create a 7-digit code:</p>
                            <ul style={{textAlign: 'left', paddingLeft: '1.5rem'}}>
                              <li>First 6 digits: Choose between dot (.) or dot-underscore (._)</li>
                              <li>Last digit: Always a dot (.)</li>
                            </ul>
                            <p>Current length: {countMorseUnits(morsePassword)}/7</p>
                          </div>
                        </>
                      )}
                      
                      {/* Confirmation View */}
                      {morseCreationStep === 2 && (
                        <>
                          <div className="morse-code-display">
                            {morsePassword}
                          </div>
                          
                          <div className="morse-instructions">
                            <p>Your Morse code password is ready!</p>
                            <p>Length: {countMorseUnits(morsePassword)}/7</p>
                            <p>Remember this code or note it down securely.</p>
                            
                            {/* Back button to recreate code if needed */}
                            <button 
                              className="action-btn preview-btn"
                              style={{ marginTop: '10px' }}
                              onClick={() => {
                                setMorseCreationStep(0);
                                setMorsePassword('');
                              }}
                            >
                              Create New Code
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                  
                  <div className="form-actions">
                    <button 
                      className="action-btn cancel-btn"
                      onClick={() => {
                        setEditingPass(null);
                        setIsCreatingPass(false);
                        setMorseCreationStep(0);
                        setMorsePassword('');
                      }}
                    >
                      Cancel
                    </button>
                    <div className="save-button-container">
                      {activeMethod === 'morse' && morseCreationStep < 2 && (
                        <div className="save-button-tooltip">
                          Please create a Morse code password first
                        </div>
                      )}
                      <button 
                        className="action-btn save-btn"
                        onClick={() => {
                          if (isCreatingPass) {
                            // For morse code, ensure we have a password
                            if (activeMethod === 'morse' && !morsePassword) {
                              alert('Please create a Morse code password first.');
                              return;
                            }
                            
                            // If creating a new pass, call addNewPass
                            // Add morse password to the pass data if applicable
                            let passToAdd = editingPass;
                            if (activeMethod === 'morse') {
                              passToAdd = { ...editingPass, morsePassword };
                            }
                            addNewPass(passToAdd);
                          } else {
                            // If editing an existing pass
                            // Update morse password if applicable
                            let passToUpdate = editingPass;
                            if (activeMethod === 'morse' && morsePassword) {
                              const binaryPassword = convertMorseToBinary(morsePassword);
                              const knockPassword = morsePassword.substring(0, morsePassword.length-1);
                              
                              passToUpdate = { 
                                ...editingPass, 
                                morsePassword,
                                binaryPassword,
                                knockPassword
                              };
                            }
                            updatePass(passToUpdate);
                          }
                          
                          // Reset morse states
                          setMorseCreationStep(0);
                          setMorsePassword('');
                        }}
                        disabled={activeMethod === 'morse' && morseCreationStep < 2}
                      >
                        Save
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal for passes */}
      {previewPass && (
        <div className="manage-modal-backdrop" onClick={() => setPreviewPass(null)}>
          <div className="manage-modal-content" 
            onClick={e => e.stopPropagation()} 
            style={{ maxWidth: '500px' }}>
            {isLoading && (
              <div className="loading-overlay">
                <div className="spinner"></div>
              </div>
            )}
            <div className="manage-modal-header">
              <div className="manage-modal-title">
                {activeMethod === 'morse' ? (
                  <div className="title-icon">•−</div>
                ) : (
                  <img 
                    src={getMethodDetails().icon} 
                    alt={`${getMethodDetails().title} Icon`} 
                    className="title-icon" 
                  />
                )}
                <h2>Pass Preview</h2>
              </div>
              <button className="close-btn" onClick={() => setPreviewPass(null)}>×</button>
            </div>
            
            <div className="manage-modal-body">
              <div className="pass-info-preview">
                <div className="preview-item">
                  <strong>ID:</strong>
                  <span>{previewPass.id}</span>
                </div>
                <div className="preview-item">
                  <strong>Name:</strong>
                  <span>{previewPass.name}</span>
                </div>
                <div className="preview-item">
                  <strong>Type:</strong>
                  <span>{previewPass.type === 'one-time' ? 'One-Time Pass' : 'Multiple Pass'}</span>
                </div>
                <div className="preview-item">
                  <strong>Expiry Time:</strong>
                  <span>{new Date(previewPass.expiryTime).toLocaleString()}</span>
                </div>
                
                {/* Show password if it's a Morse code pass */}
                {activeMethod === 'morse' && previewPass.morsePassword && (
                  <div className="morse-preview-section">
                    <h3>Morse Code Password</h3>
                    <div className="morse-code-display preview-display">
                      {previewPass.morsePassword}
                    </div>
                    
                    {previewPass.binaryPassword && (
                      <div className="preview-item" style={{marginTop: "1rem"}}>
                        <strong>Binary Format:</strong>
                        <span>{previewPass.binaryPassword}0</span>
                      </div>
                    )}
                    
                    {previewPass.knockPassword && (
                      <div className="preview-item">
                        <strong>Knock Format:</strong>
                        <span>{previewPass.knockPassword}.</span>
                      </div>
                    )}
                    
                    <div className="morse-instructions">
                      <p>Remember this code to unlock the door.</p>
                      <p>For security reasons, this is a one-time pass.</p>
                    </div>
                  </div>
                )}
                
                {/* Show QR code if it's a QR pass */}
                {activeMethod === 'qr' && (
                  <div className="qr-preview-section">
                    <h3>QR Code</h3>
                    <div className="qr-code-display">
                      <img 
                        src={`http://${RASPBERRY_PI_IP}:${DATA_PORT}/qr_code/${previewPass.id}`} 
                        alt="QR Code for Access"
                        style={{ maxWidth: "200px", margin: "20px auto", display: "block" }}
                        onLoad={() => setIsLoading(false)}
                        onError={() => {
                          setIsLoading(false);
                          console.error("Failed to load QR code");
                        }}
                      />
                      <div style={{ textAlign: "center", marginTop: "15px" }}>
                        <button 
                          className="action-btn preview-btn"
                          onClick={() => {
                            // Fetch the QR code image as a blob
                            fetch(`http://${RASPBERRY_PI_IP}:${DATA_PORT}/qr_code/${previewPass.id}`)
                              .then(response => response.blob())
                              .then(blob => {
                                // Create an object URL for the blob
                                const url = URL.createObjectURL(blob);
                                
                                // Create a link element to download the QR code
                                const link = document.createElement('a');
                                link.href = url;
                                link.download = `qr-code-${previewPass.name}.png`;
                                document.body.appendChild(link);
                                link.click();
                                
                                // Clean up by removing the link and revoking the object URL
                                setTimeout(() => {
                                  document.body.removeChild(link);
                                  URL.revokeObjectURL(url);
                                }, 100);
                              })
                              .catch(error => console.error('Error downloading QR code:', error));
                          }}
                          style={{ display: "inline-flex", alignItems: "center", justifyContent: "center" }}
                        >
                          Download QR Code
                        </button>
                      </div>
                    </div>
                    
                    <div className="qr-instructions">
                      <p>Scan this QR code with your phone to unlock the door.</p>
                      <p>{previewPass.type === 'one-time' ? 
                        "This is a one-time pass and will expire after use." : 
                        "This is a multiple-use pass valid until expiry time."}
                      </p>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="form-actions" style={{ marginTop: '2rem' }}>
                <button 
                  className="action-btn cancel-btn"
                  onClick={() => setPreviewPass(null)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {passToDelete && (
        <div className="manage-modal-backdrop" onClick={() => setPassToDelete(null)}>
          <div className="manage-modal-content" 
            onClick={e => e.stopPropagation()} 
            style={{ maxWidth: '400px' }}>
            <div className="manage-modal-header">
              <div className="manage-modal-title">
                <h2>Confirm Deletion</h2>
              </div>
              <button className="close-btn" onClick={() => setPassToDelete(null)}>×</button>
            </div>
            
            <div className="manage-modal-body">
              <div className="delete-confirmation">
                <p>Are you sure you want to delete the following pass?</p>
                <div className="pass-info-preview">
                  <div className="preview-item">
                    <strong>Name:</strong>
                    <span>{passToDelete.name}</span>
                  </div>
                  <div className="preview-item">
                    <strong>Type:</strong>
                    <span>{passToDelete.type === 'one-time' ? 'One-Time Pass' : 'Multiple Pass'}</span>
                  </div>
                </div>
                <p className="warning-text">This action cannot be undone.</p>
              </div>
              
              <div className="form-actions" style={{ marginTop: '2rem' }}>
                <button 
                  className="action-btn cancel-btn"
                  onClick={() => setPassToDelete(null)}
                >
                  Cancel
                </button>
                <button 
                  className="action-btn delete-btn"
                  onClick={confirmDeletePass}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
