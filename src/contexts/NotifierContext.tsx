import React, { createContext, useState, useContext, ReactNode } from 'react';
import Notification from '../components/Notification';

type NotificationType = 'info' | 'success' | 'warning' | 'error';

interface NotifierContextProps {
    showNotification: (message: string, type?: NotificationType, duration?: number) => void;
}

const NotifierContext = createContext<NotifierContextProps | undefined>(undefined);

export const useNotifier = () => {
    const context = useContext(NotifierContext);
    if (!context) {
        throw new Error("useNotifier must be used within a NotifierProvider");
    }
    return context;
};

interface NotifierProviderProps {
    children: ReactNode;
}

interface NotificationState {
    message: string;
    type: NotificationType;
    visible: boolean;
}

export const NotifierProvider: React.FC<NotifierProviderProps> = ({ children }) => {
    const [notification, setNotification] = useState<NotificationState>({
        message: '',
        type: 'info',
        visible: false,
    });

    const showNotification = (message: string, type: NotificationType = 'info', duration: number = 3000) => {
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
