import React, { Component } from "react";
import KickStart from "./../../navigation";
import Profile from "./../../navigation/profile";
import Dashboard from "./../../navigation/dashboard";
import Routing from "./../../navigation/routing";
import NavBar from "./../../navigation/navbar";
import AddIcon from "@material-ui/icons/Add";
import Fab from "@material-ui/core/Fab";
import HeaderSeparator from "./../header_separator";

class Auth extends Component {
  constructor(props) {
    super(props);
    this.state = {
      loading: true,
      user: null,
    };
  }

  componentDidMount() {
    this.loadSession();
  }

  loadSession = async () => {
    try {
      const response = await fetch("/auth/me", {
        credentials: "same-origin",
        headers: {
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        window.location.replace("/login");
        return;
      }

      const user = await response.json();
      this.setState(
        {
          loading: false,
          user: user,
        },
        () => {
          if (this.props.linkTo === "/logout") {
            this.logout();
          }
        }
      );
    } catch (err) {
      window.location.replace("/login");
    }
  };

  logout = async () => {
    try {
      await fetch("/logout", {
        credentials: "same-origin",
      });
    } finally {
      window.location.replace("/login");
    }
  };

  navigationBar = () => {
    return (
      <div>
        <NavBar />
        <a href="/report">
          <Fab
            color="secondary"
            aria-label="add"
            style={{
              position: "fixed",
              zIndex: 1,
              right: 0,
              bottom: 0,
              marginRight: "25px",
              marginBottom: "25px",
            }}
          >
            <AddIcon />
          </Fab>
        </a>
        <HeaderSeparator />
      </div>
    );
  };

  loginStatus() {
    if (this.state.loading) {
      return <div className="text-center text-secondary p-5">Loading...</div>;
    }

    const user = this.state.user || {};
    const userId = user.userId || user.emailId || "";

    if (this.props.linkTo === "/logout") {
      return <div className="text-center text-secondary p-5">Logging out...</div>;
    }

    switch (this.props.linkTo) {
      case "/dashboard":
      case "/":
        return (
          <div>
            <Dashboard userId={userId} />
            {this.navigationBar()}
          </div>
        );
      case "/report":
        return (
          <div>
            <KickStart userId={userId} />
            {this.navigationBar()}
          </div>
        );
      case "/routing":
        return (
          <div>
            <Routing userId={userId} />
            {this.navigationBar()}
          </div>
        );
      case "/profile":
        return (
          <div>
            <Profile
              userId={userId}
              name={user.name || (user.emailId ? user.emailId.split("@")[0] : "")}
              email={user.emailId || ""}
              photoURL=""
            />
            {this.navigationBar()}
          </div>
        );
      default:
        return (
          <div>
            <Dashboard userId={userId} />
            {this.navigationBar()}
          </div>
        );
    }
  }

  render() {
    return <div>{this.loginStatus()}</div>;
  }
}

export default Auth;
