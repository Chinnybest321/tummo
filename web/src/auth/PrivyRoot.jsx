// X sign-in. Privy creates a NEAR account for the X login the first time,
// then signs every transaction for it. Adapted from near-examples/hello-privy.
import { useEffect, useRef } from "react";
import { PrivyProvider, usePrivy, useLoginWithOAuth, useLogout } from "@privy-io/react-auth";
import { useCreateWallet, useSignRawHash } from "@privy-io/react-auth/extended-chains";
import { Account, JsonRpcProvider } from "near-api-js-v7";
import { PrivySigner } from "./signer.js";
import { setPrivy } from "./bridge.js";

const NETWORK = import.meta.env.VITE_NETWORK || "testnet";
const RPC = NETWORK === "mainnet" ? "https://rpc.mainnet.fastnear.com" : "https://rpc.testnet.fastnear.com";
const provider = new JsonRpcProvider({ url: RPC });

function Bridge() {
  const { ready, authenticated, user } = usePrivy();
  const { initOAuth } = useLoginWithOAuth();
  const { logout } = useLogout();
  const { createWallet } = useCreateWallet();
  const { signRawHash } = useSignRawHash();
  const creating = useRef(false);

  useEffect(() => {
    setPrivy({ enabled: true, loginX: () => initOAuth({ provider: "twitter" }), logout });
  }, [initOAuth, logout]);

  useEffect(() => {
    if (!ready) return;
    if (!authenticated || !user) {
      setPrivy({ ready: true, address: null, handle: null, account: null });
      return;
    }
    const wallet = user.linkedAccounts.find((a) => a.type === "wallet" && a.chainType === "near");
    if (!wallet) {
      if (!creating.current) {
        creating.current = true;
        createWallet({ chainType: "near" })
          .catch((e) => console.error("Could not create NEAR account", e))
          .finally(() => (creating.current = false));
      }
      return;
    }
    const signer = new PrivySigner(signRawHash, wallet.address, provider);
    setPrivy({
      ready: true,
      address: wallet.address,
      handle: user.twitter?.username ? `@${user.twitter.username}` : null,
      account: new Account(wallet.address, provider, signer),
    });
  }, [ready, authenticated, user, createWallet, signRawHash]);

  return null;
}

export default function PrivyRoot({ children }) {
  return (
    <PrivyProvider
      appId={import.meta.env.VITE_PRIVY_APP_ID}
      clientId={import.meta.env.VITE_PRIVY_APP_CLIENT_ID || undefined}
      config={{
        loginMethods: ["twitter"],
        appearance: { theme: "light", accentColor: "#1d1b19", showWalletLoginFirst: false },
      }}
    >
      <Bridge />
      {children}
    </PrivyProvider>
  );
}
