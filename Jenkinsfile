pipeline{
  agent any
  stages{
    stage ('Checkout'){
      steps {
        git 'https://github.com/gokulseshiah1083/Askmehow'
      }
    }
    stage ('Build'){
      steps {
        sh 'echo "building the app"'
      }
    }
    stage ('Test'){
      steps {
        sh 'echo "Running the Test"' 
      }
    }
    stage ('Deploy'){
      steps {
        sh 'echo "Deploying "' 
      }
    }
  }
  post {
    success {
      bat 'echo "Build Successful"'
    }
    failure {
      bat 'echo "Build Failed"'
    }
}
}
    
    
