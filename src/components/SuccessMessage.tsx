import Banner from './Banner'

interface SuccessMessageProps {
  message: string
}

function SuccessMessage({ message }: SuccessMessageProps) {
  return <Banner variant="success" message={message} />
}

export default SuccessMessage
