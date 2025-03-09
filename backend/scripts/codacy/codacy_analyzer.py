#!/usr/bin/env python3
"""
Codacy Analyzer - A tool to fetch and analyze Codacy issues from branch diffs or PRs

This script can:
1. Fetch branch diff information from Codacy
2. Analyze PR details and issues
3. Provide suggestions for fixing common issues
"""

import os
import sys
import json
import argparse
import urllib.request
import urllib.parse
import urllib.error
from typing import Dict, List, Any, Optional, Union
from pathlib import Path

# ANSI color codes for terminal output
class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    BOLD = '\033[1m'
    END = '\033[0m'

# Load environment variables from .env file if it exists
try:
    from dotenv import load_dotenv
    # Get the directory where this script is located
    script_dir = Path(__file__).parent.absolute()
    env_path = script_dir / ".env"
    if env_path.exists():
        print(f"Loading environment variables from {env_path}")
        load_dotenv(dotenv_path=env_path)
    else:
        print("No .env file found, using environment variables or defaults")
except ImportError:
    print("python-dotenv not installed, using environment variables or defaults")

# Constants
# Get values from environment variables if available
ORG_PROVIDER = os.environ.get("CODACY_ORGANIZATION_PROVIDER", "gh")
ORG_NAME = os.environ.get("CODACY_USERNAME", "a-bevans")  # Organization name
REPO_NAME = os.environ.get("CODACY_PROJECT_NAME", "BiteSwipe")  # Repository name
BASE_URL = "https://app.codacy.com/api/v3"
REPO_PATH = f"analysis/organizations/{ORG_PROVIDER}/{ORG_NAME}/repositories/{REPO_NAME}"

class CodacyAnalyzer:
    """Class to interact with Codacy API and analyze results"""
    
    def __init__(self, api_token: Optional[str] = None):
        """Initialize the analyzer with API token"""
        self.api_token = api_token or os.environ.get("CODACY_API_TOKEN")
        if not self.api_token:
            print("Error: No Codacy API token provided.")
            print("Set the CODACY_API_TOKEN environment variable or pass it with --token")
            sys.exit(1)
        
        # Print environment variables if they exist
        if os.environ.get("CODACY_API_TOKEN"):
            print("Using CODACY_API_TOKEN from environment")
        if os.environ.get("CODACY_ORGANIZATION_PROVIDER"):
            print(f"Using organization provider: {os.environ.get('CODACY_ORGANIZATION_PROVIDER')}")
        if os.environ.get("CODACY_USERNAME"):
            print(f"Using username: {os.environ.get('CODACY_USERNAME')}")
        if os.environ.get("CODACY_PROJECT_NAME"):
            print(f"Using project name: {os.environ.get('CODACY_PROJECT_NAME')}")
        
        self.headers = {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "api-token": self.api_token
        }
    

    
    def get_branch_diff(self, current_branch: str, base_branch: str = "develop") -> Dict:
        """Get diff between two branches from Codacy API"""
        if not self.api_token:
            print("Error: API token required for this operation")
            return {"error": "No API token provided"}
        
        base_url = f"{BASE_URL}/{REPO_PATH}/commits/diff"
        params = {
            "from": base_branch,
            "to": current_branch
        }
        
        url = f"{base_url}?{urllib.parse.urlencode(params)}"
        
        try:
            req = urllib.request.Request(url, headers=self.headers)
            with urllib.request.urlopen(req) as response:
                return json.loads(response.read().decode('utf-8'))
        except urllib.error.HTTPError as e:
            if e.code == 404:
                print(f"Error: Branch or repository not found. Check that both '{current_branch}' and '{base_branch}' exist.")
                return {"error": f"Branch or repository not found (404). Check that both '{current_branch}' and '{base_branch}' exist."}
            else:
                print(f"HTTP Error {e.code}: {e.reason}")
                return {"error": f"HTTP Error {e.code}: {e.reason}"}
        except urllib.error.URLError as e:
            print(f"Error fetching branch diff: {e}")
            return {"error": str(e)}
    
    def get_pull_requests(self) -> List[Dict]:
        """Get list of open pull requests"""
        if not self.api_token:
            print("Error: API token required for this operation")
            return []
        
        url = f"{BASE_URL}/{REPO_PATH}/pull-requests"
        
        try:
            req = urllib.request.Request(url, headers=self.headers)
            with urllib.request.urlopen(req) as response:
                data = json.loads(response.read().decode('utf-8'))
                return data.get("data", [])
        except urllib.error.HTTPError as e:
            print(f"HTTP Error {e.code}: {e.reason}")
            return []
        except urllib.error.URLError as e:
            print(f"Error fetching pull requests: {e}")
            return []
    
    def get_pull_request_issues(self, pr_id: str) -> List[Dict]:
        """Get issues for a specific pull request"""
        if not self.api_token:
            print("Error: API token required for this operation")
            return []
        
        # First try the standard issues endpoint
        url = f"{BASE_URL}/{REPO_PATH}/pull-requests/{pr_id}/issues"
        
        try:
            req = urllib.request.Request(url, headers=self.headers)
            with urllib.request.urlopen(req) as response:
                data = json.loads(response.read().decode('utf-8'))
                issues = data.get("data", [])
                if issues:
                    return issues
                else:
                    print("No issues found at standard endpoint, trying detailed PR info...")
        except urllib.error.URLError as e:
            print(f"Error fetching PR issues: {e}")
        
        # If no issues found, try getting detailed PR info
        return self.get_detailed_pr_info(pr_id)
    
    def get_detailed_pr_info(self, pr_id: str) -> List[Dict]:
        """Get detailed information about a pull request including issues"""
        url = f"{BASE_URL}/{REPO_PATH}/pull-requests/{pr_id}"
        
        try:
            req = urllib.request.Request(url, headers=self.headers)
            with urllib.request.urlopen(req) as response:
                data = json.loads(response.read().decode('utf-8'))
                print(f"PR Details: {json.dumps(data, indent=2)}")
                
                # Try to extract issues from the PR details
                issues = []
                if "newIssues" in data:
                    for issue in data.get("newIssues", []):
                        issue["status"] = "new"
                        issues.append(issue)
                if "fixedIssues" in data:
                    for issue in data.get("fixedIssues", []):
                        issue["status"] = "fixed"
                        issues.append(issue)
                
                return issues
        except urllib.error.HTTPError as e:
            print(f"HTTP Error {e.code} for PR details: {e.reason}")
            return []
        except urllib.error.URLError as e:
            print(f"Error fetching PR details: {e}")
            return []
    
    def analyze_results(self, results: Union[List, Dict]) -> Dict:
        """Analyze Codacy results and categorize issues"""
        if not results or isinstance(results, dict) and "error" in results:
            return {
                "error": results.get("error", "No results to analyze") if isinstance(results, dict) else "No results to analyze",
                "total_issues": 0,
                "by_severity": {"critical": 0, "error": 0, "warning": 0, "info": 0},
                "by_category": {},
                "by_file": {},
                "by_delta_type": {"added": 0, "fixed": 0},
                "issues": []
            }
        
        # Initialize categories
        analysis = {
            "total_issues": 0,
            "by_severity": {"critical": 0, "error": 0, "warning": 0, "info": 0},
            "by_category": {},
            "by_file": {},
            "by_delta_type": {"added": 0, "fixed": 0},
            "issues": []
        }
        
        # Process each issue directly from results for PR format
        if isinstance(results, list):
            for issue in results:
                # Extract issue details for PR format
                if "commitIssue" in issue:
                    commit_issue = issue.get("commitIssue", {})
                    pattern_info = commit_issue.get("patternInfo", {})
                    
                    severity = pattern_info.get("severityLevel", "info").lower()
                    category = pattern_info.get("category", "Unknown")
                    file_path = commit_issue.get("filePath", "Unknown")
                    message = commit_issue.get("message", "No message")
                    line = commit_issue.get("lineNumber", 0)
                    line_text = commit_issue.get("lineText", "")
                    tool_name = commit_issue.get("toolInfo", {}).get("name", "Unknown")
                    issue_id = commit_issue.get("issueId", "Unknown")
                    delta_type = issue.get("deltaType", "Unknown")
                    
                    # Update counters
                    analysis["total_issues"] += 1
                    
                    # Categorize by delta type (Added/Fixed)
                    if delta_type and delta_type.lower() in ["added", "fixed"]:
                        delta_type_key = delta_type.lower()
                        analysis["by_delta_type"][delta_type_key] += 1
                    
                    # Categorize by severity
                    if severity.lower() in analysis["by_severity"]:
                        analysis["by_severity"][severity.lower()] += 1
                    
                    # Categorize by issue type
                    if category not in analysis["by_category"]:
                        analysis["by_category"][category] = 0
                    analysis["by_category"][category] += 1
                    
                    # Categorize by file
                    if file_path not in analysis["by_file"]:
                        analysis["by_file"][file_path] = []
                    
                    # Add issue details
                    issue_details = {
                        "severity": severity,
                        "category": category,
                        "message": message,
                        "file": file_path,
                        "line": line,
                        "line_text": line_text,
                        "tool": tool_name,
                        "issue_id": issue_id,
                        "delta_type": delta_type
                    }
                    
                    analysis["by_file"][file_path].append(issue_details)
                    analysis["issues"].append(issue_details)
                    
        # Handle traditional format if no PR issues were found
        elif analysis["total_issues"] == 0:
            issues = []
            if isinstance(results, dict) and "issues" in results:
                issues = results["issues"]
            elif isinstance(results, dict) and "data" in results:
                issues = results["data"]
            
            # Process each issue in traditional format
            for item in issues:
                issue = item.get("issue", item)
                
                # Extract issue details
                severity = issue.get("level", "unknown").lower()
                category = issue.get("category", "unknown")
                file_path = issue.get("file", "unknown")
                message = issue.get("message", "No description")
                
                # Update counters
                analysis["total_issues"] += 1
                
                if severity in analysis["by_severity"]:
                    analysis["by_severity"][severity] += 1
                
                if category not in analysis["by_category"]:
                    analysis["by_category"][category] = 0
                analysis["by_category"][category] += 1
                
                if file_path not in analysis["by_file"]:
                    analysis["by_file"][file_path] = []
                
                # Add detailed issue info
                issue_details = {
                    "severity": severity,
                    "category": category,
                    "message": message,
                    "file": file_path,
                    "line": issue.get("line", 0),
                    "pattern_id": issue.get("patternId", "unknown")
                }
                
                analysis["by_file"][file_path].append(issue_details)
                analysis["issues"].append(issue_details)
        
        return analysis
    
    def suggest_fixes(self, analysis: Dict) -> Dict:
        """Suggest fixes for common issues"""
        suggestions = {}
        
        # Check if analysis has error or is empty
        if "error" in analysis or not analysis.get("by_file"):
            return suggestions
            
        for file_path, issues in analysis["by_file"].items():
            file_suggestions = []
            
            for issue in issues:
                # Handle both old and new issue formats
                pattern_id = issue.get("pattern_id", "") 
                issue_id = issue.get("issue_id", "")
                message = issue["message"]
                line = issue["line"]
                delta_type = issue.get("delta_type", "")
                
                suggestion = {
                    "issue": f"{issue['severity'].upper()}: {message}",
                    "line": line,
                    "fix": None
                }
                
                # Add delta type information if available
                if delta_type:
                    suggestion["status"] = delta_type
                
                # Add specific fixes based on pattern IDs or messages
                if "unused variable" in message.lower():
                    suggestion["fix"] = "Remove the unused variable or prefix it with _ to indicate it's intentionally unused"
                
                elif "missing return type" in message.lower():
                    suggestion["fix"] = "Add an explicit return type annotation to the function"
                
                elif "any type" in message.lower():
                    suggestion["fix"] = "Replace 'any' with a more specific type"
                
                # Handle ESLint patterns from both formats
                pattern_check = pattern_id.lower() if pattern_id else (issue_id.lower() if issue_id else "")
                
                if "eslint" in pattern_check or "eslint" in message.lower():
                    if "no-unused-vars" in pattern_check:
                        suggestion["fix"] = "Remove the unused variable or prefix with _ if intentional"
                    elif "no-explicit-any" in pattern_check:
                        suggestion["fix"] = "Replace 'any' with a more specific type"
                    elif "prefer-const" in pattern_check:
                        suggestion["fix"] = "Use 'const' instead of 'let' for variables that aren't reassigned"
                    elif "no-unsafe-assignment" in pattern_check or "unsafe assignment" in message.lower():
                        suggestion["fix"] = "Add proper type checking or type assertions to ensure type safety"
                    elif "array-type" in pattern_check:
                        suggestion["fix"] = "Use T[] syntax instead of Array<T> for array types"
                    elif "no-unsafe-argument" in pattern_check or "unsafe argument" in message.lower():
                        suggestion["fix"] = "Add type checking or type assertions before passing arguments"
                    elif "no-unsafe-member-access" in pattern_check or "unsafe member access" in message.lower():
                        suggestion["fix"] = "Add null/undefined checks before accessing properties"
                
                # Add the suggestion if we have a fix
                if suggestion["fix"]:
                    file_suggestions.append(suggestion)
            
            if file_suggestions:
                suggestions[file_path] = file_suggestions
        
        return suggestions

    def print_analysis_summary(self, analysis: Dict):
        """Print a summary of the analysis results"""
        print("\n===== CODACY ANALYSIS SUMMARY =====")
        
        if "error" in analysis:
            print(f"Error: {analysis['error']}")
            return
            
        print(f"Total issues: {analysis['total_issues']}")
        
        if analysis['total_issues'] == 0:
            print("No issues found!")
            return
        
        # Print delta type summary (Added/Fixed)
        if "by_delta_type" in analysis and analysis["by_delta_type"]:
            print("\nIssue changes:")
            for delta_type, count in analysis["by_delta_type"].items():
                if count > 0:
                    color = Colors.RED if delta_type.upper() == 'ADDED' else Colors.GREEN if delta_type.upper() == 'FIXED' else ''
                    print(f"  {color}{delta_type.upper()}: {count}{Colors.END}")
            
        print("\nIssues by severity:")
        for severity, count in analysis["by_severity"].items():
            if count > 0:
                color = Colors.RED if severity.upper() == 'ERROR' else Colors.YELLOW
                print(f"  {color}{severity.upper()}: {count}{Colors.END}")
        
        print("\nIssues by category:")
        for category, count in analysis["by_category"].items():
            if count > 0:
                print(f"  {category}: {count}")
        
        print("\nFiles with issues:")
        for file_path, issues in analysis["by_file"].items():
            print(f"  {file_path}: {len(issues)} issues")
            
        # Print top 5 issues as examples
        if analysis["issues"]:
            print("\nExample issues (first 5):")
            for i, issue in enumerate(analysis["issues"][:5]):
                severity_color = Colors.RED if issue['severity'].upper() == 'ERROR' else Colors.YELLOW
                status_color = Colors.RED if issue.get('delta_type') == 'Added' else Colors.GREEN if issue.get('delta_type') == 'Fixed' else ''
                print(f"  {i+1}. [{severity_color}{issue['severity'].upper()}{Colors.END}] {issue['message']}")
                print(f"     File: {issue['file']}:{issue['line']}")
                if issue.get("line_text"):
                    print(f"     Code: {issue['line_text'][:100]}{'...' if len(issue['line_text']) > 100 else ''}")
                if issue.get("delta_type"):
                    print(f"     Status: {status_color}{issue['delta_type']}{Colors.END}")
    
    def print_suggestions(self, suggestions: Dict):
        """Print suggestions for fixing issues"""
        if not suggestions:
            print("\nNo automatic fix suggestions available.")
            return
        
        print(f"\n{Colors.BOLD}===== FIX SUGGESTIONS ====={Colors.END}")
        for file_path, file_suggestions in suggestions.items():
            print(f"\n{Colors.BOLD}File: {file_path}{Colors.END}")
            for suggestion in file_suggestions:
                status = suggestion.get('status', '')
                status_color = Colors.RED if status == 'Added' else Colors.GREEN if status == 'Fixed' else ''
                status_info = f" [{status_color}{status.upper()}{Colors.END}]" if status else ""
                
                severity_color = Colors.RED if 'ERROR' in suggestion['issue'] else Colors.YELLOW if 'WARNING' in suggestion['issue'] else ''
                issue_text = suggestion['issue'].replace('ERROR:', f"{severity_color}ERROR:{Colors.END}")
                issue_text = issue_text.replace('WARNING:', f"{Colors.YELLOW}WARNING:{Colors.END}")
                
                print(f"  Line {suggestion['line']}{status_info}: {issue_text}")
                print(f"    Suggestion: {Colors.BLUE}{suggestion['fix']}{Colors.END}")


def main():
    """Main function to parse arguments and run the analyzer"""
    parser = argparse.ArgumentParser(description="Codacy Analyzer - Fetch and analyze Codacy issues")
    parser.add_argument("--token", help="Codacy API token (or set CODACY_API_TOKEN env var)")
    parser.add_argument("--branch", default=None, help="Current branch to analyze")
    parser.add_argument("--base", default="main", help="Base branch to compare against (default: main)")
    parser.add_argument("--pr", help="Pull request ID to analyze")
    parser.add_argument("--output", help="Output file for results (JSON format, default: pr<PR_ID>_analysis.json or branch_analysis.json)")
    parser.add_argument("--repo", default="BiteSwipe", help="Repository name (default: BiteSwipe)")
    parser.add_argument("--org", default="a-bevans", help="Organization name (default: a-bevans)")
    parser.add_argument("--debug", action="store_true", help="Enable debug mode")
    parser.add_argument("--list-prs", action="store_true", help="List pull requests instead of analyzing")
    parser.add_argument("--raw", action="store_true", help="Print raw API responses")
    
    args = parser.parse_args()
    
    # Update the global repo and org names if provided
    global REPO_NAME, ORG_NAME, REPO_PATH
    if args.repo:
        REPO_NAME = args.repo
    if args.org:
        ORG_NAME = args.org
    
    # Update the repo path
    REPO_PATH = f"analysis/organizations/gh/{ORG_NAME}/repositories/{REPO_NAME}"
    
    # Initialize the analyzer
    analyzer = CodacyAnalyzer(api_token=args.token)
    
    # Debug mode - print API URL and headers
    if args.debug:
        print(f"Using repository name: {REPO_NAME}")
        print(f"API Base URL: {BASE_URL}")
        print(f"Headers: {analyzer.headers}")
    
    # List PRs if requested
    if args.list_prs:
        print("Fetching list of pull requests...")
        prs = analyzer.get_pull_requests()
        if prs:
            print(f"Found {len(prs)} pull requests:")
            for pr in prs:
                # Print all available information about the PR
                print(f"  PR details: {json.dumps(pr, indent=2)}")
        else:
            print("No pull requests found or error occurred.")
        sys.exit(0)
    
    results = {}
    
    # Run the appropriate analysis
    if args.pr:
        print(f"Fetching issues for PR #{args.pr}...")
        results = analyzer.get_pull_request_issues(args.pr)
    else:
        # Get current branch if not specified
        if not args.branch:
            try:
                import subprocess
                args.branch = subprocess.check_output(
                    ["git", "branch", "--show-current"], 
                    text=True
                ).strip()
                print(f"Detected current branch: {args.branch}")
            except (subprocess.SubprocessError, ImportError):
                print("Error: Could not detect current branch. Please specify with --branch")
                sys.exit(1)
        
        print(f"Fetching diff between {args.branch} and {args.base}...")
        results = analyzer.get_branch_diff(args.branch, args.base)
    
    # Analyze results
    analysis = analyzer.analyze_results(results)
    
    # Generate suggestions
    suggestions = analyzer.suggest_fixes(analysis)
    
    # Print summary and suggestions
    if args.raw:
        print("\nRaw Results:")
        print(json.dumps(results, indent=2))
    
    analyzer.print_analysis_summary(analysis)
    if not "error" in analysis:
        analyzer.print_suggestions(suggestions)
    
    # Save results to file (either specified or default)
    # Get the directory where this script is located
    script_dir = Path(__file__).parent.absolute()
    
    # Prepare base filename
    if args.output:
        # If the output path is absolute, use it as is, otherwise make it relative to the script directory
        output_path = Path(args.output)
        if not output_path.is_absolute():
            output_path = script_dir / output_path
        # Use the provided filename as the base name
        base_name = output_path.stem
        output_dir = output_path.parent
    else:
        # Create default output filename based on what was analyzed, in the script directory
        if args.pr:
            base_name = f"pr{args.pr}_analysis"
        else:
            base_name = "branch_analysis"
        output_dir = script_dir
    
    # Create paths for all output files
    all_issues_path = output_dir / f"{base_name}.json"
    fixed_issues_path = output_dir / f"{base_name}_fixed.json"
    added_issues_path = output_dir / f"{base_name}_added.json"
    
    # Prepare the complete output data
    output_data = {
        "raw_results": results,
        "analysis": analysis,
        "suggestions": suggestions
    }
    
    # Save the complete output data
    with open(all_issues_path, 'w') as f:
        json.dump(output_data, f, indent=2)
    
    # Filter issues by delta_type
    fixed_issues = [issue for issue in analysis.get("issues", []) if issue.get("delta_type") == "Fixed"]
    added_issues = [issue for issue in analysis.get("issues", []) if issue.get("delta_type") == "Added"]
    
    # Create filtered analysis for fixed issues
    fixed_analysis = {
        "total_issues": len(fixed_issues),
        "by_severity": {},
        "by_category": {},
        "by_file": {}
    }
    
    # Create filtered analysis for added issues
    added_analysis = {
        "total_issues": len(added_issues),
        "by_severity": {},
        "by_category": {},
        "by_file": {}
    }
    
    # Populate the filtered analysis with categorized data
    for issue in fixed_issues:
        severity = issue.get("severity", "Unknown")
        category = issue.get("category", "Unknown")
        file_path = issue.get("file", "Unknown")
        
        fixed_analysis["by_severity"][severity] = fixed_analysis["by_severity"].get(severity, 0) + 1
        fixed_analysis["by_category"][category] = fixed_analysis["by_category"].get(category, 0) + 1
        
        if file_path not in fixed_analysis["by_file"]:
            fixed_analysis["by_file"][file_path] = []
        fixed_analysis["by_file"][file_path].append(issue)
    
    for issue in added_issues:
        severity = issue.get("severity", "Unknown")
        category = issue.get("category", "Unknown")
        file_path = issue.get("file", "Unknown")
        
        added_analysis["by_severity"][severity] = added_analysis["by_severity"].get(severity, 0) + 1
        added_analysis["by_category"][category] = added_analysis["by_category"].get(category, 0) + 1
        
        if file_path not in added_analysis["by_file"]:
            added_analysis["by_file"][file_path] = []
        added_analysis["by_file"][file_path].append(issue)
    
    # Filter suggestions for fixed and added issues
    fixed_suggestions = {}
    added_suggestions = {}
    
    for file_path, file_suggestions in suggestions.items():
        fixed_file_suggestions = [s for s in file_suggestions if s.get("status") == "Fixed"]
        added_file_suggestions = [s for s in file_suggestions if s.get("status") == "Added"]
        
        if fixed_file_suggestions:
            fixed_suggestions[file_path] = fixed_file_suggestions
        
        if added_file_suggestions:
            added_suggestions[file_path] = added_file_suggestions
    
    # Save fixed issues data
    fixed_output_data = {
        "analysis": fixed_analysis,
        "suggestions": fixed_suggestions
    }
    
    with open(fixed_issues_path, 'w') as f:
        json.dump(fixed_output_data, f, indent=2)
    
    # Save added issues data
    added_output_data = {
        "analysis": added_analysis,
        "suggestions": added_suggestions
    }
    
    with open(added_issues_path, 'w') as f:
        json.dump(added_output_data, f, indent=2)
    
    # Print output file paths
    print(f"\n{Colors.BOLD}Results saved to:{Colors.END}")
    print(f"  {Colors.BLUE}All issues: {all_issues_path.absolute()}{Colors.END}")
    print(f"  {Colors.GREEN}Fixed issues: {fixed_issues_path.absolute()}{Colors.END}")
    print(f"  {Colors.RED}Added issues: {added_issues_path.absolute()}{Colors.END}")


if __name__ == "__main__":
    main()
