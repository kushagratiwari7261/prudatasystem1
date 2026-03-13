import React from 'react';

const SkeletonCard = () => {
    return (
        <div className="skeleton-card">
            <div className="skeleton-image shunt" />
            <div className="skeleton-info">
                <div className="skeleton-line shunt" style={{ width: '40%', height: '14.5px', marginBottom: '8px' }} />
                <div className="skeleton-line shunt" style={{ width: '80%', height: '13px', marginBottom: '12.5px' }} />
                <div className="skeleton-line shunt" style={{ width: '60%', height: '16px' }} />
            </div>
        </div>
    );
};

export default SkeletonCard;
