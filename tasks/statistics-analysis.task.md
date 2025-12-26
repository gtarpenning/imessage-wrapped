# Statistics Analysis Implementation

## Overview

Implement a clean, extensible architecture for analyzing exported iMessage data. Three distinct analyzer classes handle different types of statistics, with a pluggable display system for rendering results.

## Architecture

### Core Components

1. **StatisticsAnalyzer (ABC)** - Base interface for all analyzers
   - `analyze(data: ExportData) -> dict[str, Any]` - Main computation method
   - `name` property - Analyzer identifier

2. **Display (ABC)** - Base interface for rendering statistics
   - `render(statistics: dict[str, Any]) -> None` - Display results

### Analyzer Types

#### 1. RawStatisticsAnalyzer ✅ (Implemented)
Pure counting and aggregation logic. No external dependencies.

**Statistics to compute:**
- Volume metrics (total sent/received, by day/week/month/hour)
- Top contacts (most messaged, received from)
- Busiest periods (day, hour, day of week)
- Message characteristics (length, emoji count, link count, attachment count)
- Conversation patterns (1:1 vs group ratio, double texts, conversation starters)
- Streak tracking (consecutive days with messages)
- Response time analysis (where read receipts available)
- Tapback metrics (given/received, favorite reactions)

#### 2. NLPStatisticsAnalyzer 🚧 (Stubbed)
Static natural language processing using libraries like spaCy, NLTK.

**Planned statistics:**
- Sentiment analysis per conversation/contact
- Topic clustering (work, social, etc.)
- Word frequency (excluding stop words)
- Question/exclamation frequency
- Linguistic patterns (formality, complexity)
- Named entity extraction

**Dependencies:** spaCy, NLTK, or similar

#### 3. LLMStatisticsAnalyzer 🚧 (Stubbed)
AI-powered insights requiring LLM API calls.

**Planned statistics:**
- Custom narrative summaries
- Conversation highlights/lowlights
- Relationship dynamics insights
- Thematic analysis
- Personalized story cards
- Comparative analysis across contacts

**Dependencies:** OpenAI API, Anthropic API, or similar

### Display Implementations

#### 1. TerminalDisplay ✅ (Implemented)
Rich-formatted console output for quick review.

#### 2. Future Displays 🚧
- HTMLDisplay - Interactive web report
- PDFDisplay - Shareable document
- ImageDisplay - Social media cards

## Implementation Details

### Data Flow

```
ExportData (from JSONL)
    ↓
StatisticsAnalyzer.analyze()
    ↓
dict[str, Any] (computed statistics)
    ↓
Display.render()
    ↓
Output (terminal/HTML/PDF/etc)
```

### File Structure

```
src/imessage_wrapped/
├── analyzer.py              # Analyzer base + implementations
├── displays/
│   ├── __init__.py
│   ├── base.py             # Display ABC
│   └── terminal.py         # TerminalDisplay
└── cli.py                  # Add 'analyze' command
```

### CLI Usage

```bash
# Analyze exported data
imessage-wrapped analyze exports/imessage_export_2025.jsonl

# Specify display format
imessage-wrapped analyze exports/imessage_export_2025.jsonl --display terminal

# Run specific analyzers only
imessage-wrapped analyze exports/imessage_export_2025.jsonl --analyzers raw,nlp

# Output to file
imessage-wrapped analyze exports/imessage_export_2025.jsonl --output stats.json
```

## Design Principles

1. **Single Responsibility** - Each analyzer handles one category of statistics
2. **Open/Closed** - Easy to add new analyzers without modifying existing code
3. **Dependency Inversion** - Depend on abstractions (ABC) not concretions
4. **DRY** - Shared utilities extracted to helper functions
5. **Readability** - Clear naming, minimal comments needed

## Testing Strategy

1. Unit tests for each analyzer with fixture data
2. Integration tests for full analysis pipeline
3. Snapshot tests for display outputs
4. Performance benchmarks for large datasets

## Future Enhancements

- [ ] Parallel analysis execution for large datasets
- [ ] Incremental analysis (cache intermediate results)
- [ ] Plugin system for custom analyzers
- [ ] Configuration file for customizing which stats to compute
- [ ] Export statistics to multiple formats simultaneously
- [ ] Comparison mode (2024 vs 2025)
- [ ] Real-time analysis as messages export

## Priority

**Phase 1 (Current):**
- ✅ RawStatisticsAnalyzer implementation
- ✅ TerminalDisplay implementation
- ✅ CLI integration

**Phase 2:**
- 🚧 NLPStatisticsAnalyzer implementation
- 🚧 HTMLDisplay implementation
- 🚧 Statistics persistence (JSON output)

**Phase 3:**
- 🚧 LLMStatisticsAnalyzer implementation
- 🚧 Advanced visualizations
- 🚧 Shareable report generation

