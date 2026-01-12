import React from 'react';
import { XCircle, CheckCircle, Info, AlertTriangle } from 'lucide-react';

type NotificationType = 'success' | 'error' | 'info' | 'warning';

const icons: Record<NotificationType, React.ReactNode> = {
    success: <CheckCircle className="text-green-500" />,
    error: <XCircle className="text-red-500" />,
    info: <Info className="text-blue-500" />,
    warning: <AlertTriangle className="text-yellow-500" />,
};

interface NotificationProps {
    message: string;
    type?: NotificationType;
    visible: boolean;
}

const Notification: React.FC<NotificationProps> = ({ message, type = 'info', visible }) => {
    if (!visible) return null;

    return (
        <div className="fixed bottom-5 right-5 bg-gray-800 border border-gray-700 text-white p-4 rounded-lg shadow-lg flex items-center z-[100] animate-in fade-in-5 slide-in-from-bottom-2">
            <div className="flex-shrink-0">
                {icons[type]}
            </div>
            <div className="ml-3">
                <p className="text-sm font-medium">{message}</p>
            </div>
        </div>
    );
};

export default Notification;
