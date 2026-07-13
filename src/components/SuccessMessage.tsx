interface SuccessMessageProps {
  message: string
}

function SuccessMessage({ message }: SuccessMessageProps) {
  return (
    <div className="success-message" role="status">
      {message}
    </div>
  )
}

export default SuccessMessage
