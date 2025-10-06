import React, { useState } from "react";
import axios from "axios";

function App() {
  const [input, setInput] = useState("");
  const [result, setResult] = useState("");

  const sendTransaction = async () => {
    const response = await axios.post(
      "https://5cmltg64dl.execute-api.us-east-1.amazonaws.com/prod",
      JSON.parse(input)
    );
    setResult(response.data);
  };

  return (
    <div style={{ textAlign: "center" }}>
      <h2>Fraud Detection Demo</h2>
      <textarea
        rows="8"
        cols="60"
        value={input}
        onChange={(e) => setInput(e.target.value)}
      />
      <br />
      <button onClick={sendTransaction}>Send Transaction</button>
      <pre>{JSON.stringify(result, null, 2)}</pre>
    </div>
  );
}

export default App;
