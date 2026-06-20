import { useState } from "react";
import type { FormEvent } from "react";

type BackendKeyLoaderProps = {
  isLoading: boolean;
  onLoad: (key: string) => void;
};

export function BackendKeyLoader({ isLoading, onLoad }: BackendKeyLoaderProps) {
  const [key, setKey] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedKey = key.trim();
    if (trimmedKey) {
      onLoad(trimmedKey);
    }
  }

  return (
    <form className="backend-key-panel" onSubmit={handleSubmit}>
      <label>
        <span>Verification key</span>
        <input
          autoComplete="off"
          disabled={isLoading}
          onChange={(event) => setKey(event.target.value)}
          placeholder="Enter assigned key"
          type="password"
          value={key}
        />
      </label>
      <button disabled={isLoading || !key.trim()} type="submit">
        {isLoading ? "Loading..." : "Load"}
      </button>
    </form>
  );
}
