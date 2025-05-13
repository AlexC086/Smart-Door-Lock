import { useState, useEffect } from 'react'
import './App.css'

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
    { id: 1, date: currentDateTime.date, time: currentDateTime.time, message: 'Door unlocked', method: 'Voice' },
    { id: 2, date: '2025-05-12', time: '14:35', message: 'Door unlocked', method: 'QR Code' },
    { id: 3, date: '2025-05-12', time: '09:17', message: 'Access denied', method: 'Morse Code' },
  ])
  const [isFullScreen, setIsFullScreen] = useState(false)
  const [showManageModal, setShowManageModal] = useState(false)
  const [activeMethod, setActiveMethod] = useState(null) // 'qr', 'morse', or 'voice'
  const [passes, setPasses] = useState([
    { id: 1, name: 'Main', type: 'multiple-pass', expiryTime: '2025-06-13T14:30' },
    { id: 2, name: 'Guest', type: 'one-time', expiryTime: '2025-05-15T18:00' }
  ])
  const [editingPass, setEditingPass] = useState(null)
  const [isCreatingPass, setIsCreatingPass] = useState(false)
  
  // Handle ESC key press to close modals
  useEffect(() => {
    const handleEscKey = (event) => {
      if (event.key === 'Escape') {
        if (isFullScreen) setIsFullScreen(false);
        if (showManageModal) setShowManageModal(false);
      }
    };
    
    window.addEventListener('keydown', handleEscKey);
    return () => window.removeEventListener('keydown', handleEscKey);
  }, [isFullScreen, showManageModal]);
  
  // Enforce Morse code to be one-time pass only
  useEffect(() => {
    if (activeMethod === 'morse' && editingPass && editingPass.type !== 'one-time') {
      setEditingPass({...editingPass, type: 'one-time'});
    }
  }, [activeMethod, editingPass]);
  
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
  
  // Add new pass
  const addNewPass = (type) => {
    const newPass = {
      id: Date.now(), // Simple unique ID
      name: 'New Pass',
      type: type,
      expiryTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().substring(0, 16) // Default 1 week
    };
    
    setPasses([...passes, newPass]);
    setEditingPass(newPass);
    setIsCreatingPass(false);
    
    // Add notice for new pass creation
    const methodName = activeMethod === 'qr' ? 'QR Code' : 
                     activeMethod === 'morse' ? 'Morse Code' : 'Voice';
    addNotice(`New ${type} pass created`, methodName);
  };
  
  // Delete pass
  const deletePass = (id) => {
    const passToDelete = passes.find(pass => pass.id === id);
    setPasses(passes.filter(pass => pass.id !== id));
    if (editingPass && editingPass.id === id) {
      setEditingPass(null);
    }
    
    // Add notice for deletion
    if (passToDelete) {
      const methodName = activeMethod === 'qr' ? 'QR Code' : 
                        activeMethod === 'morse' ? 'Morse Code' : 'Voice';
      addNotice(`${passToDelete.name} pass deleted`, methodName);
    }
  };
  
  // Add new notice
  const addNotice = (message, method) => {
    const { date, time } = getCurrentDateTime();
    const newNotice = {
      id: Date.now(),
      date,
      time,
      message,
      method
    };
    setNotices([newNotice, ...notices].slice(0, 20)); // Keep only the last 20 notices
  };

  // Update pass
  const updatePass = (updatedPass) => {
    setPasses(passes.map(pass => pass.id === updatedPass.id ? updatedPass : pass));
    setEditingPass(null);
    
    // Add notice for the update
    const methodName = activeMethod === 'qr' ? 'QR Code' : 
                       activeMethod === 'morse' ? 'Morse Code' : 'Voice';
    addNotice(`${updatedPass.name} pass updated`, methodName);
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
        {/* Camera Section */}          <div className="camera-section">
          <h2 className="section-title">Real-time Camera</h2>
          <div className="camera-container" onClick={() => setIsFullScreen(true)}>
            <div className="camera-placeholder">
              <span>Click to Full Screen</span>
            </div>
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
                {/* This would be your actual camera feed */}
                <div className="camera-placeholder">
                  <span>Live Camera Feed</span>
                </div>
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
                <span>Soon expired:</span>
                <button className="manage-btn" onClick={() => {
                  setActiveMethod('qr');
                  setShowManageModal(true);
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
                <span>Soon expired:</span>
                <button className="manage-btn" onClick={() => {
                  setActiveMethod('morse');
                  setShowManageModal(true);
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
                <span>Soon expired:</span>
                <button className="manage-btn" onClick={() => {
                  setActiveMethod('voice');
                  setShowManageModal(true);
                }}>Manage</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Management Modal */}
      {showManageModal && (
        <div className="manage-modal-backdrop" onClick={() => setShowManageModal(false)}>
          <div className="manage-modal-content" onClick={e => e.stopPropagation()}>
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
              <button className="close-btn" onClick={() => setShowManageModal(false)}>×</button>
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
                          setIsCreatingPass(true);
                          addNewPass('one-time');
                        }}
                      >
                        One-Time Pass
                      </button>
                      {activeMethod !== 'morse' && (
                        <button 
                          className="pass-btn multiple" 
                          onClick={() => {
                            setIsCreatingPass(true);
                            addNewPass('multiple-pass');
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
                      <span className="col-name">Name</span>
                      <span className="col-type">Type</span>
                      <span className="col-expire">Expiry Time</span>
                      <span className="col-actions">Actions</span>
                    </div>
                    
                    {passes
                      .filter(pass => activeMethod !== 'morse' || pass.type === 'one-time')
                      .map(pass => (
                        <div className="pass-item" key={pass.id}>
                          <span className="col-name">{pass.name}</span>
                          <span className="col-type">{pass.type === 'one-time' ? 'One-Time' : 'Multiple'}</span>
                          <span className="col-expire">
                            {new Date(pass.expiryTime).toLocaleString()}
                          </span>
                          <div className="col-actions">
                            <button 
                              className="action-btn preview-btn"
                              onClick={() => {/* Preview functionality */}}
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
                </>
              ) : (
                <div className="pass-edit-form">
                  <h3>{isCreatingPass ? 'Create New Pass' : 'Edit Pass'}</h3>
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
                  
                  <div className="form-actions">
                    <button 
                      className="action-btn cancel-btn"
                      onClick={() => {
                        setEditingPass(null);
                        setIsCreatingPass(false);
                      }}
                    >
                      Cancel
                    </button>
                    <button 
                      className="action-btn save-btn"
                      onClick={() => updatePass(editingPass)}
                    >
                      Save
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
