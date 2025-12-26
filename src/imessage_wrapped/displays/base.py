from abc import ABC, abstractmethod
from typing import Any


class Display(ABC):
    @abstractmethod
    def render(self, statistics: dict[str, Any]) -> None:
        pass
