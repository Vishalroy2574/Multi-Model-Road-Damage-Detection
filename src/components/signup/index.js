import React from "react";

export default function SignInSide() {
  return (
    <div className="container py-5">
      <div className="row justify-content-center">
        <div className="col-lg-8">
          <div className="card bg-dark text-light border-secondary">
            <div className="card-body p-4 p-md-5 text-center">
              <h1 className="h3 fw-bold mb-3">Use the server login page</h1>
              <p className="text-secondary mb-4">
                The old Google sign-in screen has been removed. Log in with
                email and password on the main <code>/login</code> page.
              </p>
              <a href="/login" className="btn btn-primary">
                Go to login
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
