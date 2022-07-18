import React, { useEffect, useRef } from "react"
import "./Modal.css"

export default function Modal({ children, shown, close, message }) {
  return shown ? (
    <div
      className="modal-backdrop"
      onClick={() => {
        close()
      }}
    >
      <div
        className="modal-content"
        onClick={(e) => {
          e.stopPropagation()
        }}
      >
        <div className="modal__text">
          <div>{message}</div>
        </div>
        <button onClick={close}>OK</button>
      </div>
    </div>
  ) : null
}
