import Banner from './Banner'

interface ErrorMessageProps {
  message: string
}

function ErrorMessage({ message }: ErrorMessageProps) {
  return <Banner variant="error" message={message} />
}

export default ErrorMessage
