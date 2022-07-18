import React, { useEffect, useMemo, useState } from "react"
import { useWeb3React } from "@web3-react/core"
import { WalletConnectConnector } from "@web3-react/walletconnect-connector"
import { WalletLinkConnector } from "@web3-react/walletlink-connector"
import Web3 from "web3"
import "./MintHome.css"
import otters from "../Otters.json"
import { ethers } from "ethers"
import Modal from "./Modal.js"

import EthereumSession from "../lib/eth-session.js"

/* const mainnetConfig = {
    'CONTRACT': '0x1feefaae417c43f6aeb985aeecb0e471292cba26',
    'CHAIN_ID':  1,
    'RPC_URL':   'https://mainnet.infura.io/v3/xxxxxxxxxxxxxxxx',
    'ABI':       elephant.json
} */

const ottersRinkebyConfig = {
  CONTRACT: "0x17D531198448c604b784C459A814a5f69D782b01",
  CHAIN_ID: 4,
  RPC_URL: "https://rinkeby.infura.io/v3/xxxxxxxxxxxxxxxxxxxxxxxx",
  ABI: otters,
}

const config = ottersRinkebyConfig

const CONNECTORS = {}
CONNECTORS.Walletlink = new WalletLinkConnector({
  url: config.RPC_URL,
  appLogoUrl: null,
  appName: "BURGER BOSS",
})

CONNECTORS.WalletConnect = new WalletConnectConnector({
  supportedChainIds: [config.CHAIN_ID],
  rpc: config.RPC_URL,
})

export default function MintHome() {
  const [walletAddress, setWalletAddress] = useState(null)
  const signedIn = !!walletAddress

  const [elephantWithSigner, setElephantWithSigner] = useState(null)
  const [paused, togglePause] = useState(true)
  const [ElephantPrice, setElephantPrice] = useState(0)
  const [howManyOtters, setHowManyOtters] = useState(1)
  const [mintLimit, setMintLimit] = useState()

  const [modalShown, toggleModal] = useState(false)
  const [showMintModal, setShowMintModal] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")
  const [checkedValue, setChecked] = useState(0)
  const context = useWeb3React()

  console.log(context)
  async function connectProvider(connector) {
    context.activate(connector, async (err) => {
      //other connectors
      if (err.code === 4001) {
        //WalletLink: User denied account authorization
        console.debug(err.message)
        return
      } else if (err.name === "UserRejectedRequestError") {
        //WalletConnect: The user rejected the request
        console.debug(err.message)
        return
      } else {
        console.warn(err.message)
      }
    })
  }

  const handleChange = (evt) => {
    setChecked(evt.currentTarget.value)
  }

  const ethereumSession = useMemo(() => {
    if (window.ethereum) {
      const session = new EthereumSession({
        chain: EthereumSession.COMMON_CHAINS[config.CHAIN_ID],
        contractAddress: config.CONTRACT,
        contractABI: config.ABI,
      })
      return session
    } else {
      return null
    }
  }, [])

  useEffect(() => {
    if (window.ethereum) {
      ethereumSession
        .connectEthers()
        .then(() => loadContractData())
        .then(() => {
          if (ethereumSession.hasAccounts())
            setWalletAddress(ethereumSession.wallet.accounts[0])
        })
        .catch((err) => {
          if (err.code === "CALL_EXCEPTION") {
            //we're on the wrong chain
          } else {
            console.log(err)
          }
        })
    }
  }, [])

  function redirect(to) {
    if (to === "metamask") {
      const link =
        "https://metamask.app.link/dapp/" + window.location.href.substr(8)
      window.location = link
    } else if (to === "trustwallet") {
      const link =
        "https://link.trustwallet.com/open_url?coin_id=60&url=" +
        window.location.href
      window.location = link
    }
  }

  async function signIn() {
    if (!window.ethereum) {
      setErrorMessage(
        <div id="providers">
          <p>
            No Ethereum interface injected into browser.
            <br />
            Other providers:
          </p>
          <ul>
            <li onClick={() => connectProvider(CONNECTORS.Walletlink)}>
              &bull; Coinbase Wallet
            </li>
            <li onClick={() => redirect("metamask")}>&bull; MetaMask</li>
            <li onClick={() => redirect("trustwallet")}>&bull; Trust Wallet</li>
            <li onClick={() => connectProvider(CONNECTORS.WalletConnect)}>
              &bull; WalletConnect
            </li>
          </ul>
        </div>
      )
      toggleModal(true)
      return
    }

    try {
      let curChain = await ethereumSession.getWalletChainID()
      await ethereumSession.connectEthers(true)
      if (curChain != ethereumSession.chain.hex) {
        curChain = await ethereumSession.getWalletChainID()
        if (curChain === ethereumSession.chain.hex) {
          //force the browser to switch to the new chain
          window.location.reload()
          return
        } else {
          setErrorMessage(
            `Switch network to the ${ethereumSession.chain.name} before continuing.`
          )
          toggleModal(true)
          return
        }
      }

      if (ethereumSession.hasAccounts()) {
        setWalletAddress(ethereumSession.wallet.accounts[0])
        await loadContractData()
      }
    } catch (error) {
      alert(error)
      if (error.code === 4001) {
        setErrorMessage("Sign in to mint Burgers!")
        toggleModal(true)
      } else {
        setErrorMessage(error)
        toggleModal(true)
      }
    }
  }

  async function signOut() {
    setWalletAddress(null)
  }

  async function loadContractData() {
    const elephantContract = ethereumSession.contract
    const signer = ethereumSession.ethersProvider.getSigner()

    const elephantWithSigner = elephantContract.connect(signer)
    const salebool = await elephantContract.publicSale()
    const ElephantPrice = await elephantContract.price()
    const mintLimit = await elephantContract.maxMint()
    setMintLimit(Number(mintLimit))
    setElephantWithSigner(elephantWithSigner)
    togglePause(!salebool)
    setElephantPrice(ethers.utils.formatEther(ElephantPrice))
  }

  async function mintElephant() {
    if (!signedIn || !elephantWithSigner) {
      setErrorMessage("Please connect wallet or reload the page!")
      console.log("Please connect wallet or reload the page!")
      toggleModal(true)
      return
    }

    if (paused) {
      setErrorMessage("Sale is not active yet.  Try again later!")
      console.log("Sale is not active yet.  Try again later!")
      toggleModal(true)
      return
    }

    if (!(await ethereumSession.connectAccounts(true))) {
      setErrorMessage("Please unlock your wallet and select an account.")
      console.log("Please unlock your wallet and select an account.")
      toggleModal(true)
      return
    }

    if (!(await ethereumSession.connectChain(true))) {
      setErrorMessage(
        `Please open your wallet and select ${ethereumSession.chain.name}.`
      )
      console.log(
        `Please open your wallet and select ${ethereumSession.chain.name}.`
      )
      toggleModal(true)
      return
    }

    if (
      ethereumSession.chain.hex != (await ethereumSession.getWalletChainID())
    ) {
      window.location.reload()
      return
    }

    //connected
    try {
      const price = Web3.utils.toWei(String(ElephantPrice * howManyOtters))

      const overrides = {
        from: walletAddress,
        value: price,
      }
      let number = Number(`${howManyOtters}000000000000000000`)
      const gasBN = await ethereumSession.contract.estimateGas
        .mint(howManyOtters, overrides)
        .catch((err) => console.log(err))
      const finalGasBN = gasBN
        .mul(ethers.BigNumber.from(11))
        .div(ethers.BigNumber.from(10))
      overrides.gasLimit = finalGasBN.toString()

      const txn = await elephantWithSigner.mint(howManyOtters, overrides)
      await txn.wait()
      setMintingSuccess(howManyOtters)
    } catch (error) {
      if (error.error) {
        console.log(error)
        setMintingError(error.error.message)
      }
    }
  }

  const setMintingSuccess = (howManyOtters) => {
    setErrorMessage(
      `Congrats on minting ${howManyOtters} ${
        howManyOtters > 1 ? "Otters!" : "Otter!"
      }`
    )
    toggleModal(true)
  }

  const setMintingError = (error) => {
    setErrorMessage(error)
    toggleModal(true)
  }

  function checkHowMany(newNumber) {
    if (newNumber > mintLimit) {
      setHowManyOtters(mintLimit)
    } else if (newNumber < 1) {
      setHowManyOtters("")
    } else {
      setHowManyOtters(newNumber)
    }
  }

  const mintOne = () => {
    setErrorMessage("Must mint atleast one Burger!")
    toggleModal(true)
  }

  const paraText = signedIn
    ? "Input number of Otters to mint!"
    : "Sign in above to mint Otters!"

  return (
    <>
      <video autoPlay muted loop className="bgvid">
        <source src="/images/workingbg.mp4" type="video/mp4"></source>
        Your browser does not support the video tag.
      </video>
      <button onClick={() => setShowMintModal(true)}>
        <img src="/images/mintbuttonlight.png" className="mintbutton" />
      </button>

      <div>
        <div
          className="modal"
          style={{ visibility: showMintModal ? "visible" : "hidden" }}
        >
          <div className="modal-dialog">
            <div className="modal-header">
              <h3 className="modal-title">Limited Sale</h3>
              <div
                onClick={() => setShowMintModal(false)}
                className="modal-close"
              >
                &times;
              </div>
            </div>
            {!signedIn ? (
              <button onClick={signIn}>Connect Wallet</button>
            ) : (
              <button onClick={signOut}>
                Wallet Connected
                <br /> Click to sign out
              </button>
            )}
            <div className="modal-body">
              <div className="modal-content">
                <div className="price">
                  <img
                    className="flashingotters"
                    src="/images/flashingotters.gif"
                  />
                  <div className="pricepernft">
                    <h5>Price Per NFT</h5>
                    <h2>{String(ElephantPrice)}</h2>
                  </div>
                </div>

                <div className="mintdiv">
                  <input
                    className=""
                    type="number"
                    min="1"
                    max={mintLimit}
                    value={howManyOtters}
                    onChange={(e) => checkHowMany(e.target.value)}
                    name=""
                  />
                  <button
                    onClick={() => setHowManyOtters(mintLimit)}
                    className=""
                  >
                    set max
                  </button>
                </div>

                <br />

                <div
                  className={
                    signedIn ? "minthome__mint" : "minthome__mint-false"
                  }
                >
                  {howManyOtters > 1 ? (
                    <button
                      style={{ height: "60px", width: "160px" }}
                      onClick={mintElephant}
                    >
                      MINT {howManyOtters} Otters!
                    </button>
                  ) : (
                    <button
                      style={{ height: "60px", width: "160px" }}
                      onClick={mintElephant}
                    >
                      MINT {howManyOtters} Otter!
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Modal
        shown={modalShown}
        close={() => {
          toggleModal(false)
        }}
        message={errorMessage}
      ></Modal>
    </>
  )
}
