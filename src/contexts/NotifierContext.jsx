import React, { createContext, useState, useContext } from 'react';
import Notification from '../components/Notification';

const NotifierContext = createContext();

export const useNotifier = () => useContext(NotifierContext);

export const NotifierProvider = ({ children }) => {
    const [notification, setNotification] = useState({
        message: '',
        type: 'info',
        visible: false,
    });

    const showNotification = (message, type = 'info', duration = 3000) => {
        setNotification({ message, type, visible: true });
        setTimeout(() => {
            setNotification(n => ({ ...n, visible: false }));
        }, duration);
    };

    return (
        <NotifierContext.Provider value={{ showNotification }}>
            {children}
            <Notification
                message={notification.message}
                type={notification.type}
                visible={notification.visible}
            />
        </NotifierContext.Provider>
    );
};
