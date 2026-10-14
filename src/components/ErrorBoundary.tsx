import React, { Component, ErrorInfo, ReactNode } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  failedComponent: string | null
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    failedComponent: null,
  }

  public static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      failedComponent: null,
    }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error.message)
    console.error('Component stack:', errorInfo.componentStack)

    const match = errorInfo.componentStack?.match(/^\s*at\s+([A-Za-z0-9_$.]+)/m)
    if (match && match[1]) {
      this.setState({ failedComponent: match[1] })
    }
  }

  private handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      failedComponent: null,
    })
  }

  private handleGoHome = () => {
    window.location.href = '/hoje'
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[50vh] w-full items-center justify-center p-6">
          <Card className="w-full max-w-md border border-border bg-card p-6 text-card-foreground shadow-sm">
            <div className="space-y-4">
              <div className="space-y-2">
                <h2 className="text-base font-semibold text-foreground">
                  Algo deu errado nesta tela.
                </h2>
                {this.state.failedComponent && (
                  <p className="font-mono text-xs text-muted-foreground break-all">
                    Falha no componente: {this.state.failedComponent}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Button
                  type="button"
                  onClick={this.handleReset}
                  className="rounded-full text-xs font-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Tentar de novo
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={this.handleGoHome}
                  className="rounded-full text-xs font-normal border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Voltar ao Painel
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )
    }

    return this.props.children
  }
}
