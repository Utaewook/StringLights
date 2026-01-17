import React from 'react'
import Layout from './components/layout/Layout'
import ErrorPage from './components/common/ErrorPage'
import CookieConsent from './components/common/CookieConsent' // Import
import useUIStore from './store/uiStore'
import './App.css'

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        console.error("Uncaught error:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return <ErrorPage code={500} message="Application Error" />;
        }

        return this.props.children;
    }
}

function App() {
    const { theme } = useUIStore();
    return (
        <div className={`app-root ${theme}-theme`}>
            <ErrorBoundary>
                <Layout />
                <CookieConsent />
            </ErrorBoundary>
        </div>
    )
}

export default App
