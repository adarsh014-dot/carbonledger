import React from "react";
import { AlertTriangle } from "lucide-react";
import { Button, Card } from "./ui";

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error("CarbonLedger UI error:", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <Card className="card-pad stack">
          <div className="row" style={{ color: "var(--danger)", gap: 8 }}>
            <AlertTriangle size={18} />
            <strong>Something went wrong while rendering this page.</strong>
          </div>
          <pre
            className="mono small"
            style={{
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              background: "var(--surface-2)",
              border: "1px solid var(--line)",
              borderRadius: 10,
              padding: 12,
              margin: 0,
            }}
          >
            {this.state.error?.message || String(this.state.error)}
          </pre>
          <div className="row">
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                this.setState({ error: null });
                window.location.reload();
              }}
            >
              Reload
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => this.setState({ error: null })}
            >
              Dismiss
            </Button>
          </div>
        </Card>
      );
    }

    return this.props.children;
  }
}
