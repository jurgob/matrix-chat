class ScreenshotReporter {
  onTestEnd(test, result) {
    if (result.status === 'failed' && result.attachments.length > 0) {
      const screenshots = result.attachments.filter(attachment => 
        attachment.name === 'screenshot' && attachment.path
      );
      
      if (screenshots.length > 0) {
        console.log('\n📸 Screenshots saved:');
        screenshots.forEach(screenshot => {
          console.log(`   ${screenshot.path}`);
        });
        console.log('');
      }
    }
  }
}

export default ScreenshotReporter;