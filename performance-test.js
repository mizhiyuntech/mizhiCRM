#!/usr/bin/env node

/**
 * Performance Testing Script for 米执云客户管理系统
 * Run this script to analyze performance metrics of your CRM application
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

class PerformanceAnalyzer {
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || 'http://localhost:3000';
    this.outputDir = options.outputDir || './performance-reports';
    this.headless = options.headless !== false;
    
    // Ensure output directory exists
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  async analyzePage(url, pageName) {
    const browser = await puppeteer.launch({ 
      headless: this.headless,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    try {
      const page = await browser.newPage();
      
      // Enable performance monitoring
      await page.setCacheEnabled(false);
      await page.setViewport({ width: 1920, height: 1080 });
      
      // Start performance monitoring
      await page.coverage.startJSCoverage();
      await page.coverage.startCSSCoverage();
      
      const startTime = Date.now();
      
      // Navigate to page and wait for network idle
      await page.goto(url, { 
        waitUntil: 'networkidle2',
        timeout: 30000 
      });
      
      const loadTime = Date.now() - startTime;
      
      // Get Web Vitals
      const webVitals = await this.getWebVitals(page);
      
      // Get resource loading metrics
      const resourceMetrics = await this.getResourceMetrics(page);
      
      // Get coverage data
      const jsCoverage = await page.coverage.stopJSCoverage();
      const cssCoverage = await page.coverage.stopCSSCoverage();
      
      // Calculate bundle sizes
      const bundleAnalysis = this.analyzeBundleSize(jsCoverage, cssCoverage);
      
      // Get lighthouse metrics
      const lighthouseMetrics = await this.getLighthouseMetrics(page, url);
      
      const results = {
        pageName,
        url,
        timestamp: new Date().toISOString(),
        loadTime,
        webVitals,
        resourceMetrics,
        bundleAnalysis,
        lighthouseMetrics
      };
      
      // Save results
      await this.saveResults(results, pageName);
      
      return results;
      
    } finally {
      await browser.close();
    }
  }

  async getWebVitals(page) {
    return await page.evaluate(() => {
      return new Promise((resolve) => {
        let vitals = {};
        
        // Function to capture web vitals
        function captureVital(name, value, rating) {
          vitals[name] = { value, rating };
        }
        
        // Import web-vitals if available
        if (typeof getCLS !== 'undefined') {
          getCLS(({ name, value, rating }) => captureVital(name, value, rating));
          getFID(({ name, value, rating }) => captureVital(name, value, rating));
          getFCP(({ name, value, rating }) => captureVital(name, value, rating));
          getLCP(({ name, value, rating }) => captureVital(name, value, rating));
          getTTFB(({ name, value, rating }) => captureVital(name, value, rating));
        }
        
        // Fallback measurements
        const navigation = performance.getEntriesByType('navigation')[0];
        if (navigation) {
          vitals.DOMContentLoaded = {
            value: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
            rating: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart < 1500 ? 'good' : 'needs-improvement'
          };
          
          vitals.LoadEvent = {
            value: navigation.loadEventEnd - navigation.loadEventStart,
            rating: navigation.loadEventEnd - navigation.loadEventStart < 2500 ? 'good' : 'needs-improvement'
          };
        }
        
        setTimeout(() => resolve(vitals), 1000);
      });
    });
  }

  async getResourceMetrics(page) {
    return await page.evaluate(() => {
      const resources = performance.getEntriesByType('resource');
      
      const resourceTypes = {
        scripts: [],
        stylesheets: [],
        images: [],
        fonts: [],
        other: []
      };
      
      let totalSize = 0;
      
      resources.forEach(resource => {
        const type = this.getResourceType(resource.name);
        const size = resource.transferSize || resource.encodedBodySize || 0;
        
        totalSize += size;
        
        resourceTypes[type].push({
          name: resource.name,
          size,
          duration: resource.duration,
          startTime: resource.startTime
        });
      });
      
      return {
        totalResources: resources.length,
        totalSize,
        byType: resourceTypes,
        slowestResources: resources
          .sort((a, b) => b.duration - a.duration)
          .slice(0, 5)
          .map(r => ({ name: r.name, duration: r.duration }))
      };
    });
  }

  getResourceType(url) {
    if (url.match(/\.(js|jsx|ts|tsx)$/)) return 'scripts';
    if (url.match(/\.(css|scss|sass)$/)) return 'stylesheets';
    if (url.match(/\.(jpg|jpeg|png|gif|webp|avif|svg)$/)) return 'images';
    if (url.match(/\.(woff|woff2|ttf|otf|eot)$/)) return 'fonts';
    return 'other';
  }

  analyzeBundleSize(jsCoverage, cssCoverage) {
    let totalJSSize = 0;
    let usedJSSize = 0;
    let totalCSSSize = 0;
    let usedCSSSize = 0;
    
    jsCoverage.forEach(coverage => {
      totalJSSize += coverage.text.length;
      
      coverage.ranges.forEach(range => {
        usedJSSize += range.end - range.start;
      });
    });
    
    cssCoverage.forEach(coverage => {
      totalCSSSize += coverage.text.length;
      
      coverage.ranges.forEach(range => {
        usedCSSSize += range.end - range.start;
      });
    });
    
    return {
      javascript: {
        totalSize: totalJSSize,
        usedSize: usedJSSize,
        unusedSize: totalJSSize - usedJSSize,
        utilizationRate: totalJSSize > 0 ? (usedJSSize / totalJSSize * 100).toFixed(2) : 0
      },
      css: {
        totalSize: totalCSSSize,
        usedSize: usedCSSSize,
        unusedSize: totalCSSSize - usedCSSSize,
        utilizationRate: totalCSSSize > 0 ? (usedCSSSize / totalCSSSize * 100).toFixed(2) : 0
      }
    };
  }

  async getLighthouseMetrics(page, url) {
    // Simplified lighthouse-like metrics
    const metrics = await page.metrics();
    
    return {
      JSHeapUsedSize: metrics.JSHeapUsedSize,
      JSHeapTotalSize: metrics.JSHeapTotalSize,
      JSEventListeners: metrics.JSEventListeners,
      Nodes: metrics.Nodes,
      Documents: metrics.Documents,
      Frames: metrics.Frames,
      TaskDuration: metrics.TaskDuration
    };
  }

  async saveResults(results, pageName) {
    const fileName = `${pageName}-${Date.now()}.json`;
    const filePath = path.join(this.outputDir, fileName);
    
    fs.writeFileSync(filePath, JSON.stringify(results, null, 2));
    
    // Also save a summary report
    this.generateSummaryReport(results, pageName);
  }

  generateSummaryReport(results, pageName) {
    const report = `
# Performance Report for ${pageName}

**Generated:** ${results.timestamp}
**URL:** ${results.url}

## Key Metrics

### Loading Performance
- **Total Load Time:** ${results.loadTime}ms
- **DOM Content Loaded:** ${results.webVitals.DOMContentLoaded?.value || 'N/A'}ms
- **Load Event:** ${results.webVitals.LoadEvent?.value || 'N/A'}ms

### Web Vitals
${Object.entries(results.webVitals).map(([key, vital]) => 
  `- **${key}:** ${vital.value}ms (${vital.rating})`
).join('\n')}

### Bundle Analysis
#### JavaScript
- **Total Size:** ${(results.bundleAnalysis.javascript.totalSize / 1024).toFixed(2)} KB
- **Used Size:** ${(results.bundleAnalysis.javascript.usedSize / 1024).toFixed(2)} KB
- **Unused Size:** ${(results.bundleAnalysis.javascript.unusedSize / 1024).toFixed(2)} KB
- **Utilization Rate:** ${results.bundleAnalysis.javascript.utilizationRate}%

#### CSS
- **Total Size:** ${(results.bundleAnalysis.css.totalSize / 1024).toFixed(2)} KB
- **Used Size:** ${(results.bundleAnalysis.css.usedSize / 1024).toFixed(2)} KB
- **Unused Size:** ${(results.bundleAnalysis.css.unusedSize / 1024).toFixed(2)} KB
- **Utilization Rate:** ${results.bundleAnalysis.css.utilizationRate}%

### Resource Loading
- **Total Resources:** ${results.resourceMetrics.totalResources}
- **Total Size:** ${(results.resourceMetrics.totalSize / 1024).toFixed(2)} KB

#### Slowest Resources
${results.resourceMetrics.slowestResources.map(resource => 
  `- ${resource.name}: ${resource.duration.toFixed(2)}ms`
).join('\n')}

## Recommendations

${this.generateRecommendations(results)}
`;

    const reportPath = path.join(this.outputDir, `${pageName}-summary.md`);
    fs.writeFileSync(reportPath, report);
    
    console.log(`Performance report saved to: ${reportPath}`);
  }

  generateRecommendations(results) {
    const recommendations = [];
    
    // Bundle size recommendations
    if (results.bundleAnalysis.javascript.utilizationRate < 50) {
      recommendations.push('⚠️ **JavaScript utilization is low** - Consider code splitting to reduce unused code');
    }
    
    if (results.bundleAnalysis.css.utilizationRate < 60) {
      recommendations.push('⚠️ **CSS utilization is low** - Remove unused CSS rules or implement critical CSS');
    }
    
    // Loading time recommendations
    if (results.loadTime > 3000) {
      recommendations.push('⚠️ **Slow loading time** - Optimize images, enable compression, and implement caching');
    }
    
    // Resource recommendations
    if (results.resourceMetrics.totalResources > 100) {
      recommendations.push('⚠️ **Too many resources** - Consider bundling and reducing HTTP requests');
    }
    
    // Web Vitals recommendations
    if (results.webVitals.LCP?.value > 2500) {
      recommendations.push('⚠️ **Poor LCP** - Optimize largest contentful paint by optimizing images and critical resources');
    }
    
    if (results.webVitals.FID?.value > 100) {
      recommendations.push('⚠️ **Poor FID** - Reduce JavaScript execution time and optimize event handlers');
    }
    
    if (recommendations.length === 0) {
      recommendations.push('✅ **Great performance!** - All metrics are within acceptable ranges');
    }
    
    return recommendations.join('\n');
  }

  async runFullAnalysis() {
    console.log('Starting performance analysis...');
    
    const pages = [
      { url: `${this.baseUrl}/`, name: 'home' },
      { url: `${this.baseUrl}/customers`, name: 'customers' },
      { url: `${this.baseUrl}/dashboard`, name: 'dashboard' },
      { url: `${this.baseUrl}/reports`, name: 'reports' }
    ];
    
    const results = [];
    
    for (const page of pages) {
      try {
        console.log(`Analyzing ${page.name}...`);
        const result = await this.analyzePage(page.url, page.name);
        results.push(result);
        console.log(`✅ ${page.name} analysis complete`);
      } catch (error) {
        console.error(`❌ Error analyzing ${page.name}:`, error.message);
      }
    }
    
    // Generate overall summary
    this.generateOverallSummary(results);
    
    console.log(`\nPerformance analysis complete! Reports saved to: ${this.outputDir}`);
    return results;
  }

  generateOverallSummary(results) {
    const summary = {
      timestamp: new Date().toISOString(),
      totalPages: results.length,
      averageLoadTime: results.reduce((sum, r) => sum + r.loadTime, 0) / results.length,
      performanceScore: this.calculateOverallScore(results)
    };
    
    fs.writeFileSync(
      path.join(this.outputDir, 'overall-summary.json'),
      JSON.stringify(summary, null, 2)
    );
  }

  calculateOverallScore(results) {
    // Simple scoring algorithm (0-100)
    let totalScore = 0;
    
    results.forEach(result => {
      let pageScore = 100;
      
      // Deduct points for poor metrics
      if (result.loadTime > 3000) pageScore -= 20;
      if (result.loadTime > 5000) pageScore -= 30;
      
      if (result.bundleAnalysis.javascript.utilizationRate < 50) pageScore -= 15;
      if (result.bundleAnalysis.css.utilizationRate < 60) pageScore -= 10;
      
      if (result.webVitals.LCP?.value > 2500) pageScore -= 25;
      if (result.webVitals.FID?.value > 100) pageScore -= 20;
      
      totalScore += Math.max(0, pageScore);
    });
    
    return Math.round(totalScore / results.length);
  }
}

// CLI usage
if (require.main === module) {
  const analyzer = new PerformanceAnalyzer({
    baseUrl: process.env.BASE_URL || 'http://localhost:3000',
    headless: process.env.HEADLESS !== 'false'
  });
  
  analyzer.runFullAnalysis()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('Performance analysis failed:', err);
      process.exit(1);
    });
}

module.exports = PerformanceAnalyzer;