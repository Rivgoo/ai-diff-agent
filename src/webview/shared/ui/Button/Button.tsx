import type { ButtonHTMLAttributes, ReactNode } from 'react';
import styles from './Button.module.css';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'danger' | 'icon';
    children: ReactNode;
}

export const Button = ({ variant = 'primary', children, className = '', ...props }: ButtonProps) => {
    const combinedClassName = `${styles.button} ${styles[variant]} ${className}`.trim();

    return (
        <button type="button" className={combinedClassName} {...props}>
            {children}
        </button>
    );
};
